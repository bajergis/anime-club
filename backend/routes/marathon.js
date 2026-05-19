import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';
import { getAnimeById, searchAnime, formatAnimeData } from '../services/anilist.js';

const router = Router();

router.use(requireAuth, requireGroupMember);

// ── Helper: check group owns this marathon ────────────────────
function getMarathon(marathonId, groupId) {
  return db.prepare(
    'SELECT * FROM marathons WHERE id = ? AND group_id = ?'
  ).get(marathonId, groupId);
}

// ── Helper: check group owner ─────────────────────────────────
function isOwner(req) {
  const group = db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(req.groupId);
  return group?.owner_id === req.userId;
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
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can create marathons' });

  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO marathons (group_id, name, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run(req.groupId, name.trim(), description?.trim() || null, req.userId);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PATCH /api/marathons/:id ──────────────────────────────────
router.patch('/:id', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can edit marathons' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const { name, description, status } = req.body;
  const validStatuses = ['active', 'completed'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare(`
    UPDATE marathons SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(name?.trim() || null, description?.trim() || null, status || null, req.params.id);

  res.json({ ok: true });
});

// ── DELETE /api/marathons/:id ─────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can delete marathons' });

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

  // Attach locks to each entry
  const entryIds = entries.map(e => e.id);
  const locks = entryIds.length
    ? db.prepare(`
        SELECT ml.*, m.name AS member_name, m.avatar_url
        FROM marathon_locks ml
        JOIN members m ON m.id = ml.member_id
        WHERE ml.entry_id IN (${entryIds.map(() => '?').join(',')})
      `).all(...entryIds)
    : [];

  const entriesWithLocks = entries.map(e => ({
    ...e,
    anilist_data: e.anilist_data ? JSON.parse(e.anilist_data) : null,
    locks: locks.filter(l => l.entry_id === e.id),
  }));

  res.json({ ...marathon, entries: entriesWithLocks });
});

// ── POST /api/marathons/:id/entries ───────────────────────────
router.post('/:id/entries', async (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can add entries' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const { anime_title, anilist_id, position } = req.body;
  if (!anime_title?.trim()) return res.status(400).json({ error: 'anime_title is required' });

  // Determine position — append to end if not specified
  let pos = position;
  if (pos == null) {
    const last = db.prepare(
      'SELECT MAX(position) AS max_pos FROM marathon_entries WHERE marathon_id = ?'
    ).get(req.params.id);
    pos = (last?.max_pos ?? -1) + 1;
  }

  // Fetch AniList data
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
  } catch (e) {
    console.warn('AniList lookup failed:', e.message);
  }

  const result = db.prepare(`
    INSERT INTO marathon_entries (marathon_id, position, anime_title, anilist_id, anilist_data, added_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, pos, resolved_title, resolved_anilist_id, anilist_data, req.userId);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PATCH /api/marathons/:id/entries/:entryId ─────────────────
// Owner: change status (upcoming/active/done) or reorder
router.patch('/:id/entries/:entryId', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can edit entries' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare(
    'SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ?'
  ).get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { status, position } = req.body;
  const validStatuses = ['upcoming', 'active', 'done'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Only one active entry at a time — deactivate current active before activating new one
  if (status === 'active') {
    db.prepare(`
      UPDATE marathon_entries SET status = 'upcoming'
      WHERE marathon_id = ? AND status = 'active'
    `).run(req.params.id);
  }

  db.prepare(`
    UPDATE marathon_entries SET
      status = COALESCE(?, status),
      position = COALESCE(?, position)
    WHERE id = ?
  `).run(status || null, position ?? null, req.params.entryId);

  res.json({ ok: true });
});

// ── DELETE /api/marathons/:id/entries/:entryId ────────────────
router.delete('/:id/entries/:entryId', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can remove entries' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare(
    'SELECT id FROM marathon_entries WHERE id = ? AND marathon_id = ?'
  ).get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  db.prepare('DELETE FROM marathon_entries WHERE id = ?').run(req.params.entryId);
  res.json({ ok: true });
});

// ── POST /api/marathons/:id/entries/:entryId/lock ─────────────
router.post('/:id/entries/:entryId/lock', (req, res) => {
  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare(
    `SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ? AND status = 'active'`
  ).get(req.params.entryId, req.params.id);
  if (!entry) return res.status(400).json({ error: 'Entry is not currently active' });

  try {
    db.prepare(`
      INSERT INTO marathon_locks (entry_id, member_id)
      VALUES (?, ?)
    `).run(req.params.entryId, req.session.memberId);
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

  db.prepare(
    'DELETE FROM marathon_locks WHERE entry_id = ? AND member_id = ?'
  ).run(req.params.entryId, req.session.memberId);

  res.json({ ok: true });
});

// ── PATCH /api/marathons/:id/entries/:entryId/locks/:memberId ─
// Owner: toggle showed_up
router.patch('/:id/entries/:entryId/locks/:memberId', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can toggle attendance' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const lock = db.prepare(
    'SELECT * FROM marathon_locks WHERE entry_id = ? AND member_id = ?'
  ).get(req.params.entryId, req.params.memberId);
  if (!lock) return res.status(404).json({ error: 'Lock not found' });

  db.prepare(
    'UPDATE marathon_locks SET showed_up = ? WHERE entry_id = ? AND member_id = ?'
  ).run(lock.showed_up ? 0 : 1, req.params.entryId, req.params.memberId);

  res.json({ ok: true, showed_up: !lock.showed_up });
});

// ── POST /api/marathons/:id/entries/:entryId/sync ─────────────
// Triggered by owner when marking entry done — fetches AniList ratings
router.post('/:id/entries/:entryId/sync', async (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the group owner can trigger sync' });

  const marathon = getMarathon(req.params.id, req.groupId);
  if (!marathon) return res.status(404).json({ error: 'Marathon not found' });

  const entry = db.prepare(
    'SELECT * FROM marathon_entries WHERE id = ? AND marathon_id = ?'
  ).get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!entry.anilist_id) return res.status(400).json({ error: 'Entry has no AniList ID — cannot sync' });

  const locks = db.prepare(`
    SELECT ml.*, m.anilist_username
    FROM marathon_locks ml
    JOIN members m ON m.id = ml.member_id
    WHERE ml.entry_id = ? AND ml.showed_up = 1
  `).all(req.params.entryId);

  const STATUS_MAP = {
    CURRENT: 'watching', COMPLETED: 'completed',
    DROPPED: 'dropped', PAUSED: 'hiatus', PLANNING: 'pending',
  };

  const results = await Promise.all(locks.map(async lock => {
    if (!lock.anilist_username) return null;
    try {
      const res2 = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($username: String, $mediaId: Int) {
            MediaList(userName: $username, mediaId: $mediaId) { score status }
          }`,
          variables: { username: lock.anilist_username, mediaId: entry.anilist_id },
        }),
      }).then(r => r.json());
      const entry2 = res2?.data?.MediaList;
      if (!entry2) return null;
      // AniList scores are 0-100, normalize to 0-10
      const rating = entry2.score ? entry2.score / 10 : null;
      const status = STATUS_MAP[entry2.status] || null;
      db.prepare(`
        UPDATE marathon_locks
        SET rating = ?, anilist_status = ?, synced_at = datetime('now')
        WHERE entry_id = ? AND member_id = ?
      `).run(rating, status, lock.entry_id, lock.member_id);
      return { member_id: lock.member_id, rating, status };
    } catch { return null; }
  }));

  // Also mark entry as done after sync
  db.prepare(`UPDATE marathon_entries SET status = 'done' WHERE id = ?`).run(req.params.entryId);

  res.json({ synced: results.filter(Boolean).length });
});

export default router;