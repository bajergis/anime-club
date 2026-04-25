import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';

const router = Router();

// All stats routes require auth + group membership
router.use(requireAuth, requireGroupMember);

// GET /api/stats/overview
router.get('/overview', (req, res) => {
  const totalAnime = db.prepare(`
    SELECT COUNT(*) AS c FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ?
  `).get(req.groupId).c;

  const avgRating = db.prepare(`
    SELECT AVG(a.rating) AS avg FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ? AND a.rating IS NOT NULL
  `).get(req.groupId).avg;

  const seasons = db.prepare(
    'SELECT COUNT(*) AS c FROM seasons WHERE group_id = ?'
  ).get(req.groupId).c;

  const members = db.prepare(
    'SELECT COUNT(*) AS c FROM members WHERE group_id = ?'
  ).get(req.groupId).c;

  const dropped = db.prepare(`
    SELECT COUNT(*) AS c FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ? AND a.status = 'dropped'
  `).get(req.groupId).c;

  const rated = db.prepare(`
    SELECT COUNT(*) AS c FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ? AND a.rating IS NOT NULL
  `).get(req.groupId).c;

  res.json({ totalAnime, rated, avgRating, seasons, members, dropped });
});

// GET /api/stats/members
router.get('/members', (req, res) => {
  const members = db.prepare(
    'SELECT * FROM members WHERE group_id = ?'
  ).all(req.groupId);

  const stats = members.map(m => {
    const received = db.prepare(`
      SELECT COUNT(*) AS total, AVG(a.rating) AS avg_rating,
        AVG(CASE WHEN a.status = 'completed' THEN 1.0 ELSE 0 END) AS completion_rate,
        MIN(a.rating) AS min_rating, MAX(a.rating) AS max_rating
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
    `).get(m.id, req.groupId);

    const given = db.prepare(`
      SELECT COUNT(*) AS total, AVG(a.rating) AS avg_rating_received,
        MIN(a.rating) AS min_given, MAX(a.rating) AS max_given
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assigner_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
    `).get(m.id, req.groupId);

    const allData = db.prepare(`
      SELECT a.anilist_data FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.anilist_data IS NOT NULL AND s.group_id = ?
    `).all(m.id, req.groupId);

    const genreCounts = {};
    for (const row of allData) {
      try {
        const d = JSON.parse(row.anilist_data);
        for (const g of (d.genres || [])) genreCounts[g] = (genreCounts[g] || 0) + 1;
      } catch {}
    }
    const top_genres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    const best = db.prepare(`
      SELECT a.anime_title, a.rating FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
      ORDER BY a.rating DESC LIMIT 1
    `).get(m.id, req.groupId);

    const worst = db.prepare(`
      SELECT a.anime_title, a.rating FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
      ORDER BY a.rating ASC LIMIT 1
    `).get(m.id, req.groupId);

    const tasteRows = db.prepare(`
      SELECT a.rating, a.anilist_data FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND a.anilist_data IS NOT NULL AND s.group_id = ?
    `).all(m.id, req.groupId);

    const offsets = tasteRows.map(r => {
      try {
        const d = JSON.parse(r.anilist_data);
        if (d.average_score) return r.rating - (d.average_score / 10);
      } catch {}
      return null;
    }).filter(v => v !== null);
    const tasteOffset = offsets.length
      ? offsets.reduce((a, b) => a + b, 0) / offsets.length
      : null;

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

// GET /api/stats/season/:id
router.get('/season/:id', (req, res) => {
  const season = db.prepare(
    'SELECT * FROM seasons WHERE id = ? AND group_id = ?'
  ).get(req.params.id, req.groupId);
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
    WHERE r.season_id = ? AND m.group_id = ?
    GROUP BY m.id
  `).all(req.params.id, req.groupId);

  const allData = db.prepare(`
    SELECT a.anilist_data FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    WHERE r.season_id = ? AND a.anilist_data IS NOT NULL
  `).all(req.params.id);

  const genreFreq = {};
  for (const row of allData) {
    try {
      const d = JSON.parse(row.anilist_data);
      for (const g of (d.genres || [])) genreFreq[g] = (genreFreq[g] || 0) + 1;
    } catch {}
  }
  const top_genres = Object.entries(genreFreq)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  res.json({ season, rollStats, memberBreakdown, top_genres });
});

// GET /api/stats/head-to-head
router.get('/head-to-head', (req, res) => {
  const rows = db.prepare(`
    SELECT a.assigner_id, a.assignee_id,
      AVG(a.rating) AS avg_rating,
      COUNT(*) AS count
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ? AND a.rating IS NOT NULL
    GROUP BY a.assigner_id, a.assignee_id
  `).all(req.groupId);
  res.json(rows);
});

export default router;