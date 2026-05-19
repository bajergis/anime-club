import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';
import { getAnimeById, searchAnime, formatAnimeData } from '../services/anilist.js';

const router = Router();

router.use(requireAuth, requireGroupMember);

const STATUS_MAP = {
  CURRENT: 'watching', COMPLETED: 'completed',
  DROPPED: 'dropped', PAUSED: 'hiatus', PLANNING: 'pending',
};

// ── Helpers ───────────────────────────────────────────────────
function getMarathon(marathonId, groupId) {
  return db.prepare('SELECT * FROM marathons WHERE id = ? AND group_id = ?').get(marathonId, groupId);
}

function checkOwner(req, res) {
  const group = db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(req.groupId);
  if (group?.owner_id !== req.userId) {
    res.status(403).json({ error: 'Only the group owner can do this' });
    return false;
  }
  return true;

function normalizeAniListRating(score) {
  if (score == null) return null;

  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) return null;

  return n > 10 ? n / 10 : n;
}

// Try to fetch AniList rating for a member on a specific media
async function fetchAniListRating(anilistUsername, anilistId) {
  if (!anilistUsername || !anilistId) return null;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($username: String, $mediaId: Int) {
          MediaList(userName: $username, mediaId: $mediaId) { score status }
        }`,
        variables: { username: anilistUsername, mediaId: anilistId },
      }),
    }).then(r => r.json());

    const entry = res?.data?.MediaList;
    if (!entry) return null;

    return {
      rating: normalizeAniListRating(entry.score),
      anilist_status: STATUS_MAP[entry.status] || null,
    };
  } catch {
    return null;
  }
}

// ── GET /api/marathons ────────────────────────────────────────
router.get('/', (req, res) => {
  const marathons = db.prepare(`
    SELECT m.*,
      COUNT(DISTINCT me.id) AS entry_count,
      COUNT(DISTINCT CASE WHEN me.status = 'done' THEN me.id END) AS done_count,
      COUNT(DISTINCT CASE WHEN me.status = 'active' THEN me.id END) AS has_active
    FROM marathons m
    LEFT JOIN marathon_entries me ON me.marathon_id = m.id
    WHERE m.group_id = ?
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `).all(req.groupId);
  res.json(marathons);
});

// ── POST /api/marathons ───────────────────────────────────────
router.post('/', (req, res) => {
  if (!checkOwner(req, res)) return;
  const { name, description, started_at } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO marathons (group_id, name, description, created_by, started_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.groupId, name.trim(), description?.trim() || null, req.userId, started_at || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PATCH /api/marathons/:id ──────────────────────────────────
router.patch('/:id', (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const { name, description, status, started_at, ended_at } = req.body;
  const validStatuses = ['active', 'completed'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare(`
    UPDATE marathons SET
      name        = COALESCE(?, name),
      description = COALESCE(?, description),
      status      = COALESCE(?, status),
      started_at  = COALESCE(?, started_at),
      ended_at    = COALESCE(?, ended_at)
    WHERE id = ?
  `).run(
    name?.trim() || null,
    description?.trim() || null,
    status || null,
    started_at || null,
    ended_at || null,
    req.params.id
  );

  res.json({ ok: true });
});

// ── DELETE /api/marathons/:id ─────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });
  db.prepare('DELETE FROM marathons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/marathons/:id ────────────────────────────────────
router.get('/:id', (req, res) => {
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entries = db.prepare(`
    SELECT me.*,
      COUNT(DISTINCT ml.id) AS lock_count,
      AVG(CASE WHEN ml.showed_up = 1 AND ml.rating IS NOT NULL THEN ml.rating END) AS avg_rating
    FROM marathon_entries me
    LEFT JOIN marathon_locks ml ON ml.entry_id = me.id
    WHERE me.marathon_id = ?
    GROUP BY me.id
    ORDER BY me.position ASC, me.id ASC
  `).all(req.params.id);

  const entryIds = entries.map(e => e.id);
  const locks = entryIds.length
    ? db.prepare(`
        SELECT ml.*, m.name AS member_name, m.avatar_url
        FROM marathon_locks ml
        JOIN members m ON m.id = ml.member_id
        WHERE ml.entry_id IN (${entryIds.map(() => '?').join(',')})
      `).all(...entryIds)
    : [];

  // Fetch all group members so owner can add missing locks
  const members = db.prepare(
    'SELECT id, name, avatar_url, anilist_username FROM members WHERE group_id = ?'
  ).all(req.groupId);

  const entriesWithLocks = entries.map(e => ({
    ...e,
    anilist_data: e.anilist_data ? JSON.parse(e.anilist_data) : null,
    locks: locks.filter(l => l.entry_id === e.id),
  }));

  res.json({ ...marathon, entries: entriesWithLocks, members });
});

// ── POST /api/marathons/:id/entries ──────────────────────────
router.post('/:id/entries', async (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const { anime_title, anilist_id, position, watched_at } = req.body;
  if (!anime_title?.trim()) return res.status(400).json({ error: 'anime_title is required' });

  let pos = position;
  if (pos == null) {
    const last = db.prepare('SELECT MAX(position) AS max_pos FROM marathon_entries WHERE marathon_id = ?').get(req.params.id);
    pos = (last?.max_pos ?? -1) + 1;
  }

  let anilist_data = null;
  let resolved_anilist_id = anilist_id || null;
  let resolved_title = anime_title.trim();
  try {
    let media;
    if (anilist_id) {
      media = await getAnimeById(anilist_id);
    } else {
      const results = await searchAnime(anime_title);
      if (results.length) media = results[0];
    }
    if (media) {
      const formatted = formatAnimeData(media);
      anilist_data = JSON.stringify(formatted);
      resolved_anilist_id = formatted.anilist_id;
      resolved_title = formatted.title_english || formatted.title_romaji || resolved_title;
    }
  } catch (e) { console.warn('AniList lookup failed:', e.message); }

  const result = db.prepare(`
    INSERT INTO marathon_entries (marathon_id, position, anime_title, anilist_id, anilist_data, added_by, watched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, pos, resolved_title, resolved_anilist_id, anilist_data, req.userId, watched_at || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PATCH /api/marathons/:id/entries/:entryId ─────────────────
router.patch('/:id/entries/:entryId', (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare('SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { status, position, watched_at } = req.body;
  const validStatuses = ['upcoming', 'active', 'done'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Only one active entry at a time
  if (status === 'active') {
    db.prepare(`UPDATE marathon_entries SET status = 'upcoming' WHERE marathon_id = ? AND status = 'active'`).run(req.params.id);
  }

  db.prepare(`
    UPDATE marathon_entries SET
      status     = COALESCE(?, status),
      position   = COALESCE(?, position),
      watched_at = COALESCE(?, watched_at)
    WHERE id = ?
  `).run(status || null, position ?? null, watched_at || null, req.params.entryId);

  res.json({ ok: true });
});

// ── DELETE /api/marathons/:id/entries/:entryId ────────────────
router.delete('/:id/entries/:entryId', (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare('SELECT id FROM marathon_entries WHERE id = ? AND marathon_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  db.prepare('DELETE FROM marathon_entries WHERE id = ?').run(req.params.entryId);
  res.json({ ok: true });
});

// ── POST /api/marathons/:id/entries/:entryId/lock ─────────────
// Member locks in (active entries only)
router.post('/:id/entries/:entryId/lock', (req, res) => {
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare(`SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ? AND status = 'active'`).get(req.params.entryId, req.params.id);
  if (!entry) return res.status(400).json({ error: 'Entry is not currently active' });

  try {
    db.prepare('INSERT INTO marathon_locks (entry_id, member_id) VALUES (?, ?)').run(req.params.entryId, req.session.memberId);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Already locked in' });
    throw e;
  }
});

// ── DELETE /api/marathons/:id/entries/:entryId/lock ───────────
router.delete('/:id/entries/:entryId/lock', (req, res) => {
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  db.prepare('DELETE FROM marathon_locks WHERE entry_id = ? AND member_id = ?').run(req.params.entryId, req.session.memberId);
  res.json({ ok: true });
});

// ── POST /api/marathons/:id/entries/:entryId/locks ────────────
// Owner: manually add a member lock (for backfill / historical data)
// Tries AniList first, falls back to provided manual rating
router.post('/:id/entries/:entryId/locks', async (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare('SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { member_id, rating: manualRating, showed_up = 1 } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });

  // Verify member belongs to this group
  const memberRow = db.prepare('SELECT * FROM members WHERE id = ? AND group_id = ?').get(member_id, req.groupId);
  if (!memberRow) return res.status(404).json({ error: 'Member not found in this group' });

  // Try AniList first
  let rating = null;
  let anilist_status = null;
  let synced_at = null;

  if (entry.anilist_id && memberRow.anilist_username) {
    const aniResult = await fetchAniListRating(memberRow.anilist_username, entry.anilist_id);
    if (aniResult?.rating != null) {
      rating = aniResult.rating;
      anilist_status = aniResult.anilist_status;
      synced_at = new Date().toISOString();
    }
  }

  // Fall back to manual rating if AniList had nothing
  if (rating == null && manualRating != null) {
    rating = Number(manualRating);
  }

  try {
    db.prepare(`
      INSERT INTO marathon_locks (entry_id, member_id, showed_up, rating, anilist_status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entry_id, member_id) DO UPDATE SET
        showed_up      = excluded.showed_up,
        rating         = excluded.rating,
        anilist_status = excluded.anilist_status,
        synced_at      = excluded.synced_at
    `).run(req.params.entryId, member_id, showed_up ? 1 : 0, rating, anilist_status, synced_at);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, rating, anilist_status, synced_from_anilist: synced_at != null });
});

// ── PATCH /api/marathons/:id/entries/:entryId/locks/:memberId ─
// Owner: toggle showed_up OR manually update rating
router.patch('/:id/entries/:entryId/locks/:memberId', async (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const lock = db.prepare('SELECT * FROM marathon_locks WHERE entry_id = ? AND member_id = ?').get(req.params.entryId, req.params.memberId);
  if (!lock) return res.status(404).json({ error: 'Lock not found' });

  const { showed_up, rating: manualRating, resync } = req.body;

  let rating = lock.rating;
  let anilist_status = lock.anilist_status;
  let synced_at = lock.synced_at;

  // Optionally re-sync from AniList
  if (resync) {
    const entry = db.prepare('SELECT * FROM marathon_entries WHERE id = ?').get(req.params.entryId);
    const memberRow = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.memberId);
    if (entry?.anilist_id && memberRow?.anilist_username) {
      const aniResult = await fetchAniListRating(memberRow.anilist_username, entry.anilist_id);
      if (aniResult?.rating != null) {
        rating = aniResult.rating;
        anilist_status = aniResult.anilist_status;
        synced_at = new Date().toISOString();
      }
    }
  }

  // Manual rating override (only if not resynced or resync found nothing)
  if (manualRating != null && rating === lock.rating) {
    rating = Number(manualRating);
    synced_at = null; // mark as manually set
  }

  const newShowedUp = showed_up !== undefined ? (showed_up ? 1 : 0) : lock.showed_up;

  db.prepare(`
    UPDATE marathon_locks SET
      showed_up      = ?,
      rating         = ?,
      anilist_status = ?,
      synced_at      = ?
    WHERE entry_id = ? AND member_id = ?
  `).run(newShowedUp, rating, anilist_status, synced_at, req.params.entryId, req.params.memberId);

  res.json({ ok: true, showed_up: !!newShowedUp, rating, anilist_status });
});

// ── POST /api/marathons/:id/entries/:entryId/sync ─────────────
// Owner triggers when marking done — syncs all locked-in members from AniList
router.post('/:id/entries/:entryId/sync', async (req, res) => {
  if (!checkOwner(req, res)) return;
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare('SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!entry.anilist_id) return res.status(400).json({ error: 'Entry has no AniList ID — cannot sync' });

  const { watched_at } = req.body;

  const locks = db.prepare(`
    SELECT ml.*, m.anilist_username
    FROM marathon_locks ml
    JOIN members m ON m.id = ml.member_id
    WHERE ml.entry_id = ? AND ml.showed_up = 1
  `).all(req.params.entryId);

  const results = await Promise.all(locks.map(async lock => {
    const aniResult = await fetchAniListRating(lock.anilist_username, entry.anilist_id);
    const rating = aniResult?.rating ?? lock.rating ?? null; // keep existing if nothing found
    const status = aniResult?.anilist_status ?? lock.anilist_status ?? null;
    const synced_at = aniResult ? new Date().toISOString() : lock.synced_at;

    db.prepare(`
      UPDATE marathon_locks
      SET rating = ?, anilist_status = ?, synced_at = ?
      WHERE entry_id = ? AND member_id = ?
    `).run(rating, status, synced_at, lock.entry_id, lock.member_id);

    return { member_id: lock.member_id, rating, from_anilist: !!aniResult };
  }));

  // Mark entry done and set watched_at
  db.prepare(`
    UPDATE marathon_entries SET status = 'done', watched_at = COALESCE(?, watched_at, datetime('now'))
    WHERE id = ?
  `).run(watched_at || null, req.params.entryId);

  res.json({ synced: results.filter(r => r.from_anilist).length, total: results.length });
});

export default router;