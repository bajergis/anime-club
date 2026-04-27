import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';
import { generateDerangement, generateWeightedDerangement } from '../services/derangement.js';

const router = Router();

router.use(requireAuth, requireGroupMember);

// ── GET /api/rolls/:id/status ─────────────────────────────────
router.get('/:id/status', (req, res) => {
  const roll = db.prepare(`
    SELECT r.*, s.group_id, s.name AS season_name, s.id AS season_id
    FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });

  const readiness = db.prepare(`
    SELECT rr.member_id, m.name, rr.locked_at
    FROM roll_readiness rr
    JOIN members m ON m.id = rr.member_id
    WHERE rr.roll_id = ?
  `).all(req.params.id);

  const groupMembers = db.prepare(
    'SELECT id, name, avatar_url FROM members WHERE group_id = ?'
  ).all(req.groupId);

  const selections = db.prepare(`
    SELECT assigner_id, assignee_id, selected_at
    FROM roll_selections
    WHERE roll_id = ?
  `).all(req.params.id);

  const derangementRow = db.prepare(
    'SELECT result FROM derangement_history WHERE roll_id = ? LIMIT 1'
  ).get(req.params.id);
  const derangement = derangementRow ? JSON.parse(derangementRow.result) : null;

  res.json({
    roll,
    state: roll.state,
    readiness,           // array of { member_id, name, locked_at }
    groupMembers,        // all members so UI can show who hasn't locked in
    selections,          // array of { assigner_id, assignee_id, selected_at } no titles
    derangement,         // { assignerId: assigneeId } revealed in selecting phase to assigners
  });
});

// ── POST /api/rolls/:id/lock-in ───────────────────────────────
router.post('/:id/lock-in', (req, res) => {
  const roll = db.prepare(`
    SELECT r.* FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });
  if (roll.state !== 'drafting') return res.status(409).json({ error: 'Roll is not in drafting state' });

  // req.session.memberId is the members.id (e.g. "jsn")
  const member = db.prepare(
    'SELECT id FROM members WHERE id = ? AND group_id = ?'
  ).get(req.session.memberId, req.groupId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  db.prepare(`
    INSERT OR IGNORE INTO roll_readiness (roll_id, member_id) VALUES (?, ?)
  `).run(req.params.id, member.id);

  res.json({ ok: true });
});

// ── DELETE /api/rolls/:id/lock-in ────────────────────────────
router.delete('/:id/lock-in', (req, res) => {
  const roll = db.prepare(`
    SELECT r.* FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });
  if (roll.state !== 'drafting') return res.status(409).json({ error: 'Cannot un-ready after generation' });

  db.prepare(
    'DELETE FROM roll_readiness WHERE roll_id = ? AND member_id = ?'
  ).run(req.params.id, req.session.memberId);

  res.json({ ok: true });
});

// ── POST /api/rolls/:id/generate ─────────────────────────────
router.post('/:id/generate', (req, res) => {
  try {
    const roll = db.prepare(`
      SELECT r.*, g.owner_id FROM rolls r
      JOIN seasons s ON r.season_id = s.id
      JOIN groups g ON g.id = s.group_id
      WHERE r.id = ? AND s.group_id = ?
    `).get(req.params.id, req.groupId);
    if (!roll) return res.status(404).json({ error: 'Roll not found' });
    if (roll.state !== 'drafting') return res.status(409).json({ error: 'Roll is not in drafting state' });

    const sessionMember = db.prepare(
      'SELECT user_id FROM members WHERE id = ? AND group_id = ?'
    ).get(req.session.memberId, req.groupId);
    if (sessionMember?.user_id !== roll.owner_id) {
      return res.status(403).json({ error: 'Only the group owner can generate the roll' });
    }

    const { member_ids } = req.body;
    const participants = member_ids?.length >= 2
      ? member_ids
      : db.prepare('SELECT member_id FROM roll_readiness WHERE roll_id = ?')
          .all(req.params.id).map(r => r.member_id);

    if (participants.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 members' });
    }

    const historicalPairs = db.prepare(`
      SELECT a.assigner_id, a.assignee_id, COUNT(*) AS times
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE s.group_id = ? AND r.state = 'completed'
      GROUP BY a.assigner_id, a.assignee_id
    `).all(req.groupId);

    const pairCounts = {};
    for (const row of historicalPairs) {
      pairCounts[`${row.assigner_id}→${row.assignee_id}`] = row.times;
    }

    const derangement = generateWeightedDerangement(participants, pairCounts);

    db.prepare(
      'INSERT OR REPLACE INTO derangement_history (season_id, roll_id, result) VALUES (?, ?, ?)'
    ).run(roll.season_id, roll.id, JSON.stringify(derangement));

    db.prepare('UPDATE rolls SET state = ? WHERE id = ?').run('selecting', roll.id);

    res.json({ ok: true, derangement });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rolls/:id/select ────────────────────────────────
router.post('/:id/select', async (req, res) => {
  const { anime_title, anilist_id, anilist_data } = req.body;

  const roll = db.prepare(`
    SELECT r.* FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });
  if (roll.state !== 'selecting') return res.status(409).json({ error: 'Roll is not in selecting state' });

  const derangementRow = db.prepare(
    'SELECT result FROM derangement_history WHERE roll_id = ? LIMIT 1'
  ).get(req.params.id);
  if (!derangementRow) return res.status(500).json({ error: 'No derangement found' });

  const derangement = JSON.parse(derangementRow.result);
  const assigneeId = derangement[req.session.memberId];
  if (!assigneeId) return res.status(403).json({ error: 'You are not an assigner in this roll' });

  if (!anime_title?.trim()) return res.status(400).json({ error: 'anime_title is required' });

  db.prepare(`
    INSERT OR REPLACE INTO roll_selections (roll_id, assigner_id, assignee_id, anime_title, anilist_id, anilist_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.session.memberId, assigneeId, anime_title, anilist_id ?? null, anilist_data ? JSON.stringify(anilist_data) : null);

  const totalAssigners = Object.keys(derangement).length;
  const totalSelected = db.prepare(
    'SELECT COUNT(*) AS c FROM roll_selections WHERE roll_id = ?'
  ).get(req.params.id).c;

  if (totalSelected >= totalAssigners) {
    const selections = db.prepare('SELECT * FROM roll_selections WHERE roll_id = ?').all(req.params.id);
    for (const sel of selections) {
      db.prepare(`
        INSERT OR IGNORE INTO assignments (roll_id, assignee_id, assigner_id, anime_title, anilist_id, anilist_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sel.roll_id, sel.assignee_id, sel.assigner_id, sel.anime_title, sel.anilist_id, sel.anilist_data);
    }
    db.prepare('UPDATE rolls SET state = ? WHERE id = ?').run('active', roll.id);
    return res.json({ ok: true, revealed: true });
  }

  res.json({ ok: true, revealed: false });
});

// ── GET /api/rolls/:id ────────────────────────────────────────
router.get('/:id', (req, res) => {
  const roll = db.prepare(`
    SELECT r.*, s.group_id, s.name AS season_name, s.owner_id
    FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });
  res.json(roll);
});

// ── PATCH /api/rolls/:id/state ────────────────────────────────
router.patch('/:id/state', (req, res) => {
  const { state } = req.body;
  const validStates = ['drafting', 'selecting', 'active', 'completed'];
  if (!validStates.includes(state)) return res.status(400).json({ error: 'Invalid state' });

  const roll = db.prepare(`
    SELECT r.*, s.owner_id FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE r.id = ? AND s.group_id = ?
  `).get(req.params.id, req.groupId);
  if (!roll) return res.status(404).json({ error: 'Roll not found' });

  const sessionMember = db.prepare(
    'SELECT user_id FROM members WHERE id = ? AND group_id = ?'
  ).get(req.session.memberId, req.groupId);
  if (sessionMember?.user_id !== roll.owner_id) {
    return res.status(403).json({ error: 'Only the group owner can change roll state' });
  }

  db.prepare('UPDATE rolls SET state = ? WHERE id = ?').run(state, roll.id);
  res.json({ ok: true });
});

export default router;