import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';

const router = Router();

// All members routes require auth + group membership
router.use(requireAuth, requireGroupMember);

// GET /api/members — only members in the current user's group
router.get('/', (req, res) => {
  const members = db.prepare(
    'SELECT * FROM members WHERE group_id = ? ORDER BY name'
  ).all(req.groupId);
  res.json(members);
});

// GET /api/members/:id
router.get('/:id', (req, res) => {
  const member = db.prepare(
    'SELECT * FROM members WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json(member);
});

// PATCH /api/members/:id
router.patch('/:id', (req, res) => {
  const { name, anilist_username } = req.body;
  const member = db.prepare(
    'SELECT * FROM members WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
  if (!member) return res.status(404).json({ error: 'Not found' });

  const fields = [];
  const vals = [];
  if (name !== undefined)             { fields.push('name = ?');             vals.push(name); }
  if (anilist_username !== undefined) { fields.push('anilist_username = ?'); vals.push(anilist_username); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  db.prepare(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

export default router;