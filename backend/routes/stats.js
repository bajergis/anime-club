import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/stats/overview — global stats
router.get('/overview', (req, res) => {
  const totalAnime = db.prepare('SELECT COUNT(*) AS c FROM assignments').get().c;
  const rated = db.prepare('SELECT COUNT(*) AS c FROM assignments WHERE rating IS NOT NULL').get().c;
  const avgRating = db.prepare('SELECT AVG(rating) AS avg FROM assignments WHERE rating IS NOT NULL').get().avg;
  const seasons = db.prepare('SELECT COUNT(*) AS c FROM seasons').get().c;
  const members = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  const dropped = db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status = 'dropped'").get().c;
  res.json({ totalAnime, rated, avgRating, seasons, members, dropped });
});

// GET /api/stats/members — per-member stats
router.get('/members', (req, res) => {
  const members = db.prepare('SELECT * FROM members').all();
  const stats = members.map(m => {
    const received = db.prepare(`
      SELECT COUNT(*) AS total, AVG(rating) AS avg_rating,
        AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0 END) AS completion_rate,
        MIN(rating) AS min_rating, MAX(rating) AS max_rating
      FROM assignments WHERE assignee_id = ? AND rating IS NOT NULL
    `).get(m.id);

    const given = db.prepare(`
      SELECT COUNT(*) AS total, AVG(rating) AS avg_rating_received,
        MIN(rating) AS min_given, MAX(rating) AS max_given
      FROM assignments WHERE assigner_id = ? AND rating IS NOT NULL
    `).get(m.id);

    // Genres they've watched most
    const allData = db.prepare(
      'SELECT anilist_data FROM assignments WHERE assignee_id = ? AND anilist_data IS NOT NULL'
    ).all(m.id);
    const genreCounts = {};
    for (const row of allData) {
      try {
        const d = JSON.parse(row.anilist_data);
        for (const g of (d.genres || [])) {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        }
      } catch {}
    }
    const top_genres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    // Highest rated show they received
    const best = db.prepare(`
      SELECT anime_title, rating FROM assignments
      WHERE assignee_id = ? AND rating IS NOT NULL
      ORDER BY rating DESC LIMIT 1
    `).get(m.id);

    // Lowest rated
    const worst = db.prepare(`
      SELECT anime_title, rating FROM assignments
      WHERE assignee_id = ? AND rating IS NOT NULL
      ORDER BY rating ASC LIMIT 1
    `).get(m.id);

    // Rating they give vs AniList average (taste profile)
    const tasteRows = db.prepare(`
      SELECT a.rating, a.anilist_data FROM assignments a
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND a.anilist_data IS NOT NULL
    `).all(m.id);
    let tasteOffset = null;
    const offsets = tasteRows.map(r => {
      try {
        const d = JSON.parse(r.anilist_data);
        if (d.average_score) return r.rating - (d.average_score / 10);
      } catch {}
      return null;
    }).filter(v => v !== null);
    if (offsets.length > 0) {
      tasteOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    }

    return {
      ...m,
      received_count: received.total,
      avg_rating_given: received.avg_rating,
      completion_rate: received.completion_rate,
      min_rating: received.min_rating,
      max_rating: received.max_rating,
      recommended_count: given.total,
      avg_of_recommendations: given.avg_rating_received,
      top_genres,
      best_received: best,
      worst_received: worst,
      taste_offset_vs_anilist: tasteOffset,
    };
  });
  res.json(stats);
});

// GET /api/stats/season/:id — season-level breakdown
router.get('/season/:id', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Not found' });

  const rollStats = db.prepare(`
    SELECT r.id, r.roll_number, r.roll_date,
      COUNT(a.id) AS assignment_count,
      AVG(a.rating) AS avg_rating,
      MIN(a.rating) AS min_rating,
      MAX(a.rating) AS max_rating
    FROM rolls r
    LEFT JOIN assignments a ON a.roll_id = r.id
    WHERE r.season_id = ?
    GROUP BY r.id ORDER BY r.roll_number
  `).all(req.params.id);

  const memberBreakdown = db.prepare(`
    SELECT m.id, m.name,
      COUNT(a.id) AS total,
      AVG(a.rating) AS avg_rating,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN a.status = 'dropped' THEN 1 ELSE 0 END) AS dropped
    FROM members m
    LEFT JOIN assignments a ON a.assignee_id = m.id
    LEFT JOIN rolls r ON a.roll_id = r.id
    WHERE r.season_id = ?
    GROUP BY m.id
  `).all(req.params.id);

  const genreFreq = {};
  const allData = db.prepare(`
    SELECT a.anilist_data FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    WHERE r.season_id = ? AND a.anilist_data IS NOT NULL
  `).all(req.params.id);
  for (const row of allData) {
    try {
      const d = JSON.parse(row.anilist_data);
      for (const g of (d.genres || [])) genreFreq[g] = (genreFreq[g] || 0) + 1;
    } catch {}
  }
  const top_genres = Object.entries(genreFreq).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([genre, count]) => ({ genre, count }));

  res.json({ season, rollStats, memberBreakdown, top_genres });
});

// GET /api/stats/head-to-head — assigner → assignee rating analysis
router.get('/head-to-head', (req, res) => {
  const rows = db.prepare(`
    SELECT assigner_id, assignee_id,
      AVG(rating) AS avg_rating,
      COUNT(*) AS count
    FROM assignments
    WHERE rating IS NOT NULL
    GROUP BY assigner_id, assignee_id
  `).all();
  res.json(rows);
});

export default router;