import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';
import { generateDerangement } from '../services/derangement.js';

const router = Router();

router.use(requireAuth, requireGroupMember);

// GET /api/seasons
router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT s.*, COUNT(r.id) AS rolls_completed
    FROM seasons s
    LEFT JOIN rolls r ON r.season_id = s.id
    WHERE s.group_id = ?
    GROUP BY s.id
    ORDER BY s.id DESC
  `).all(req.groupId));
});

// GET /api/seasons/active
router.get('/active', (req, res) => {
  const season = db.prepare(
    'SELECT * FROM seasons WHERE is_active = 1 AND group_id = ? LIMIT 1'
  ).get(req.groupId);
  if (!season) return res.status(404).json({ error: 'No active season' });
  const rolls = db.prepare(
    'SELECT * FROM rolls WHERE season_id = ? ORDER BY roll_number'
  ).all(season.id);

  const currentRoll = rolls.length ? rolls[rolls.length - 1] : null;
  const currentRollState = currentRoll?.state ?? null;

  res.json({ ...season, rolls, currentRollState });
});

// POST /api/seasons
router.post('/', (req, res) => {
  const { name, started_at, roll_count } = req.body;
  db.prepare('UPDATE seasons SET is_active = 0 WHERE group_id = ?').run(req.groupId);
  const result = db.prepare(
    'INSERT INTO seasons (name, started_at, roll_count, is_active, group_id) VALUES (?, ?, ?, 1, ?)'
  ).run(
    name,
    started_at || new Date().toISOString().split('T')[0],
    roll_count ?? null,
    req.groupId,
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

// GET /api/seasons/:id/rolls
router.get('/:id/rolls', (req, res) => {
  const season = db.prepare(
    'SELECT id FROM seasons WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const rolls = db.prepare(`
    SELECT r.*,
      COUNT(a.id) AS assignment_count,
      AVG(a.rating) AS avg_rating
    FROM rolls r
    LEFT JOIN assignments a ON a.roll_id = r.id
    WHERE r.season_id = ?
    GROUP BY r.id
    ORDER BY r.roll_number
  `).all(req.params.id);
  res.json(rolls);
});

// PATCH /api/seasons/:id
router.patch('/:id', (req, res) => {
  const season = db.prepare(
    'SELECT id FROM seasons WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const { name, started_at, ended_at, is_active, roll_count } = req.body;
  const fields = [];
  const vals = [];
  if (name !== undefined)       { fields.push('name = ?');        vals.push(name); }
  if (started_at !== undefined) { fields.push('started_at = ?');  vals.push(started_at); }
  if (ended_at !== undefined)   { fields.push('ended_at = ?');    vals.push(ended_at || null); }
  if (is_active !== undefined)  { fields.push('is_active = ?');   vals.push(is_active ? 1 : 0); }
  if (roll_count !== undefined) { fields.push('roll_count = ?');  vals.push(roll_count ?? null); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  db.prepare(`UPDATE seasons SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// DELETE /api/seasons/:id/rolls/:rollId
router.delete('/:id/rolls/:rollId', (req, res) => {
  const season = db.prepare(
    'SELECT id FROM seasons WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  db.prepare('DELETE FROM assignments WHERE roll_id = ?').run(req.params.rollId);
  db.prepare('DELETE FROM derangement_history WHERE roll_id = ?').run(req.params.rollId);
  db.prepare('DELETE FROM rolls WHERE id = ? AND season_id = ?').run(req.params.rollId, req.params.id);
  res.json({ ok: true });
});

// POST /api/seasons/:id/rolls
router.post('/:id/rolls', (req, res) => {
  const { roll_date, member_ids, skip_derangement } = req.body;

  const season = db.prepare(
    'SELECT * FROM seasons WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const lastRoll = db.prepare(
    'SELECT MAX(roll_number) AS max_roll FROM rolls WHERE season_id = ?'
  ).get(req.params.id);
  const roll_number = (lastRoll.max_roll || 0) + 1;

  if (season.roll_count != null && roll_number > season.roll_count) {
    return res.status(409).json({
      error: `Season "${season.name}" is complete — all ${season.roll_count} rolls have been used.`,
    });
  }

  const rollResult = db.prepare(
    'INSERT INTO rolls (season_id, roll_number, roll_date, state) VALUES (?, ?, ?, ?)'
  ).run(
    req.params.id,
    roll_number,
    roll_date || new Date().toISOString().split('T')[0],
    skip_derangement ? 'active' : 'drafting',
  );
  const roll_id = rollResult.lastInsertRowid;

  if (skip_derangement) {
    return res.status(201).json({ roll_id, roll_number, derangement: {} });
  }

  // New flow: roll starts in drafting, derangement runs later via /rolls/:id/generate
  res.status(201).json({ roll_id, roll_number });
});

export default router;