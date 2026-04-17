import { Router } from 'express';
import { db } from '../db.js';
import { searchAnime, getAnimeById, formatAnimeData } from '../services/anilist.js';

const router = Router();

// GET /api/assignments?season_id=&roll_id=&member_id=
router.get('/', (req, res) => {
  const { season_id, roll_id, member_id } = req.query;
  let sql = `
    SELECT a.*, 
      m1.name AS assignee_name, m2.name AS assigner_name,
      r.roll_number, r.roll_date, s.name AS season_name
    FROM assignments a
    JOIN members m1 ON a.assignee_id = m1.id
    JOIN members m2 ON a.assigner_id = m2.id
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (season_id)  { sql += ' AND r.season_id = ?';     params.push(season_id); }
  if (roll_id)    { sql += ' AND a.roll_id = ?';        params.push(roll_id); }
  if (member_id)  { sql += ' AND a.assignee_id = ?';    params.push(member_id); }
  sql += ' ORDER BY s.id DESC, r.roll_number DESC, a.id ASC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/assignments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT a.*, m1.name AS assignee_name, m2.name AS assigner_name,
      r.roll_number, r.roll_date, s.name AS season_name
    FROM assignments a
    JOIN members m1 ON a.assignee_id = m1.id
    JOIN members m2 ON a.assigner_id = m2.id
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.anilist_data) row.anilist_data = JSON.parse(row.anilist_data);
  res.json(row);
});

// POST /api/assignments
router.post('/', async (req, res) => {
  const { roll_id, assignee_id, assigner_id, anime_title } = req.body;
  if (!roll_id || !assignee_id || !assigner_id || !anime_title)
    return res.status(400).json({ error: 'Missing required fields' });

  // Auto-search AniList for metadata
  let anilist_id = null;
  let anilist_data = null;
  let total_episodes = null;
  try {
    const results = await searchAnime(anime_title);
    if (results.length > 0) {
      const media = results[0];
      const formatted = formatAnimeData(media);
      anilist_id = formatted.anilist_id;
      anilist_data = JSON.stringify(formatted);
      total_episodes = formatted.episodes;
    }
  } catch (e) { console.warn('AniList lookup failed:', e.message); }

  const stmt = db.prepare(`
    INSERT INTO assignments (roll_id, assignee_id, assigner_id, anime_title, anilist_id, anilist_data, total_episodes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(roll_id, assignee_id, assigner_id, anime_title, anilist_id, anilist_data, total_episodes);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/assignments/:id — update rating, progress, status, notes
router.patch('/:id', (req, res) => {
  const { rating, episodes_watched, status, notes, anilist_id } = req.body;
  const fields = [];
  const vals = [];

  if (rating !== undefined)           { fields.push('rating = ?');            vals.push(rating); }
  if (episodes_watched !== undefined) { fields.push('episodes_watched = ?');  vals.push(episodes_watched); }
  if (status !== undefined)           { fields.push('status = ?');             vals.push(status); }
  if (notes !== undefined)            { fields.push('notes = ?');              vals.push(notes); }
  if (anilist_id !== undefined)       { fields.push('anilist_id = ?');         vals.push(anilist_id); }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.params.id);

  db.prepare(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// POST /api/assignments/:id/refresh-anilist — re-fetch AniList data
router.post('/:id/refresh-anilist', async (req, res) => {
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  try {
    let media;
    if (row.anilist_id) {
      media = await getAnimeById(row.anilist_id);
    } else {
      const results = await searchAnime(row.anime_title);
      if (!results.length) return res.status(404).json({ error: 'Not found on AniList' });
      media = results[0];
    }
    const formatted = formatAnimeData(media);
    db.prepare(`
      UPDATE assignments SET anilist_id = ?, anilist_data = ?, total_episodes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(formatted.anilist_id, JSON.stringify(formatted), formatted.episodes, row.id);
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/assignments/bulk-refresh-anilist?season_id= — backfill AniList data for seeded rows
// Accepts optional season_id query param to limit scope. Rate-limited: 1 req/700ms to respect AniList.
router.post('/bulk-refresh-anilist', async (req, res) => {
  const { season_id } = req.query;
  let sql = 'SELECT id, anime_title, anilist_id FROM assignments WHERE anilist_data IS NULL';
  const params = [];
  if (season_id) {
    sql += ' AND roll_id IN (SELECT id FROM rolls WHERE season_id = ?)';
    params.push(season_id);
  }
  sql += ' ORDER BY id LIMIT 200';
  const rows = db.prepare(sql).all(...params);

  if (!rows.length) return res.json({ updated: 0, skipped: 0 });

  // Stream progress via SSE so the admin page can show a live counter
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  let updated = 0;
  let skipped = 0;

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  for (const row of rows) {
    try {
      let media;
      if (row.anilist_id) {
        media = await getAnimeById(row.anilist_id);
      } else {
        const results = await searchAnime(row.anime_title);
        if (!results.length) { skipped++; send({ type: 'skip', title: row.anime_title }); continue; }
        media = results[0];
      }
      const formatted = formatAnimeData(media);
      db.prepare(`
        UPDATE assignments SET anilist_id = ?, anilist_data = ?, total_episodes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(formatted.anilist_id, JSON.stringify(formatted), formatted.episodes, row.id);
      updated++;
      send({ type: 'ok', title: row.anime_title, updated, remaining: rows.length - updated - skipped });
    } catch (e) {
      skipped++;
      send({ type: 'error', title: row.anime_title, error: e.message });
    }
    // Respect AniList rate limit (~90 req/min)
    await new Promise(r => setTimeout(r, 700));
  }

  send({ type: 'done', updated, skipped });
  res.end();
});

export default router;