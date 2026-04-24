import { Router } from 'express';
import { db } from '../db.js';
import { generateDerangement } from '../services/derangement.js';

const router = Router();

// GET /api/seasons
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM seasons ORDER BY id DESC').all());
});

// GET /api/seasons/active
router.get('/active', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').get();
  if (!season) return res.status(404).json({ error: 'No active season' });
  const rolls = db.prepare('SELECT * FROM rolls WHERE season_id = ? ORDER BY roll_number').all(season.id);
  res.json({ ...season, rolls });
});

// POST /api/seasons
router.post('/', (req, res) => {
  const { name, started_at, roll_count } = req.body;
  // Deactivate existing active season
  db.prepare('UPDATE seasons SET is_active = 0').run();
  const result = db.prepare(
    'INSERT INTO seasons (name, started_at, roll_count, is_active) VALUES (?, ?, ?, 1)'
  ).run(
    name,
    started_at || new Date().toISOString().split('T')[0],
    roll_count ?? null,   // null means unlimited (old behaviour)
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

// GET /api/seasons/:id/rolls
router.get('/:id/rolls', (req, res) => {
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

// PATCH /api/seasons/:id — edit name, dates, active status, roll_count
router.patch('/:id', (req, res) => {
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

// DELETE /api/seasons/:id/rolls/:rollId — remove a roll and all its assignments
router.delete('/:id/rolls/:rollId', (req, res) => {
  db.prepare('DELETE FROM assignments WHERE roll_id = ?').run(req.params.rollId);
  db.prepare('DELETE FROM derangement_history WHERE roll_id = ?').run(req.params.rollId);
  db.prepare('DELETE FROM rolls WHERE id = ? AND season_id = ?').run(req.params.rollId, req.params.id);
  res.json({ ok: true });
});

// POST /api/seasons/:id/rolls — create a new roll.
// If skip_derangement=true, just creates the roll and returns the roll_id with an empty derangement.
// The frontend (admin page) can then POST assignments manually.
router.post('/:id/rolls', (req, res) => {
  const { roll_date, member_ids, skip_derangement } = req.body;

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const lastRoll = db.prepare(
    'SELECT MAX(roll_number) AS max_roll FROM rolls WHERE season_id = ?'
  ).get(req.params.id);
  const roll_number = (lastRoll.max_roll || 0) + 1;

  // Guard: reject if this roll would exceed the season's roll_count
  if (season.roll_count != null && roll_number > season.roll_count) {
    return res.status(409).json({
      error: `Season "${season.name}" is complete — all ${season.roll_count} rolls have been used.`,
    });
  }

  const rollResult = db.prepare(
    'INSERT INTO rolls (season_id, roll_number, roll_date) VALUES (?, ?, ?)'
  ).run(req.params.id, roll_number, roll_date || new Date().toISOString().split('T')[0]);
  const roll_id = rollResult.lastInsertRowid;

  if (skip_derangement) {
    return res.status(201).json({ roll_id, roll_number, derangement: {} });
  }

  if (!member_ids || member_ids.length < 2)
    return res.status(400).json({ error: 'Need at least 2 member_ids for derangement' });

  const derangement = generateDerangement(member_ids);
  db.prepare(
    'INSERT INTO derangement_history (season_id, roll_id, result) VALUES (?, ?, ?)'
  ).run(req.params.id, roll_id, JSON.stringify(derangement));

  res.status(201).json({ roll_id, roll_number, derangement });
});

export default router;