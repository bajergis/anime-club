import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM members ORDER BY name').all()));

router.post('/', (req, res) => {
  const { id, name, anilist_username, avatar_url } = req.body;
  db.prepare('INSERT OR REPLACE INTO members (id, name, anilist_username, avatar_url) VALUES (?, ?, ?, ?)')
    .run(id || name.toLowerCase(), name, anilist_username, avatar_url);
  res.status(201).json({ ok: true });
});

router.patch('/:id', (req, res) => {
  const { name, anilist_username, avatar_url } = req.body;
  db.prepare('UPDATE members SET name = COALESCE(?, name), anilist_username = COALESCE(?, anilist_username), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
    .run(name, anilist_username, avatar_url, req.params.id);
  res.json({ ok: true });
});

export default router;