import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';

const router = Router();

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

  const bestTaste = db.prepare(`
    SELECT m.name, m.id, AVG(a.rating) AS avg_pick_rating, COUNT(*) AS pick_count
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    JOIN members m ON a.assigner_id = m.id
    WHERE s.group_id = ? AND a.rating IS NOT NULL
    GROUP BY a.assigner_id
    HAVING pick_count >= 3
    ORDER BY avg_pick_rating DESC LIMIT 1
  `).get(req.groupId);

  const hardestToPlease = db.prepare(`
    SELECT m.name, m.id, AVG(a.rating) AS avg_given, COUNT(*) AS rated_count
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    JOIN members m ON a.assignee_id = m.id
    WHERE s.group_id = ? AND a.rating IS NOT NULL
    GROUP BY a.assignee_id
    HAVING rated_count >= 3
    ORDER BY avg_given ASC LIMIT 1
  `).get(req.groupId);

  const alignmentPairs = db.prepare(`
    SELECT a1.assigner_id, a1.assignee_id,
      AVG(a1.rating) AS avg1,
      m1.name AS assigner_name, m2.name AS assignee_name
    FROM assignments a1
    JOIN rolls r ON a1.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    JOIN members m1 ON a1.assigner_id = m1.id
    JOIN members m2 ON a1.assignee_id = m2.id
    WHERE s.group_id = ? AND a1.rating IS NOT NULL
    GROUP BY a1.assigner_id, a1.assignee_id
    HAVING COUNT(*) >= 2
  `).all(req.groupId);

  let bestAlignment = null;
  let smallestDiff = Infinity;
  for (const p1 of alignmentPairs) {
    const p2 = alignmentPairs.find(p =>
      p.assigner_id === p1.assignee_id && p.assignee_id === p1.assigner_id
    );
    if (p2) {
      const diff = Math.abs(p1.avg1 - p2.avg1);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestAlignment = { names: [p1.assigner_name, p1.assignee_name], diff: diff.toFixed(2) };
      }
    }
  }

// Longest streak — consecutive completed rolls going backwards from most recent
  const allCompletedRolls = db.prepare(`
    SELECT r.id AS roll_id, r.roll_number, s.id AS season_id
    FROM rolls r
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ? AND r.state = 'completed'
    ORDER BY r.id DESC
  `).all(req.groupId);

  const memberRollIds = db.prepare(`
    SELECT DISTINCT a.assignee_id, a.roll_id
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE s.group_id = ?
  `).all(req.groupId);

  const memberRollSets = {};
  for (const row of memberRollIds) {
    if (!memberRollSets[row.assignee_id]) memberRollSets[row.assignee_id] = new Set();
    memberRollSets[row.assignee_id].add(row.roll_id);
  }

  const allRollIds = allCompletedRolls.map(r => r.roll_id);

  let longestStreakCount = 0;
  const streakLeaders = [];

  for (const [memberId, rollSet] of Object.entries(memberRollSets)) {
    let streak = 0;
    for (const rollId of allRollIds) {
      if (rollSet.has(rollId)) streak++;
      else break;
    }
    if (streak > longestStreakCount) {
      longestStreakCount = streak;
      streakLeaders.length = 0;
      streakLeaders.push(memberId);
    } else if (streak === longestStreakCount && streak > 0) {
      streakLeaders.push(memberId);
    }
  }

  const streakNames = streakLeaders.map(id => {
    return db.prepare('SELECT name FROM members WHERE id = ?').get(id)?.name;
  }).filter(Boolean);

  const longestStreak = longestStreakCount > 0
    ? { names: streakNames, seasons: longestStreakCount }
    : null;

  res.json({ totalAnime, rated, avgRating, seasons, members, dropped, bestTaste, hardestToPlease, bestAlignment, longestStreak });
});

// GET /api/stats/members
router.get('/members', (req, res) => {
  const members = db.prepare(
    'SELECT * FROM members WHERE group_id = ?'
  ).all(req.groupId);

  const stats = members.map(m => {
    const received = db.prepare(`
      SELECT COUNT(*) AS total,
        AVG(a.rating) AS avg_rating,
        AVG(CASE WHEN a.status = 'completed' THEN 1.0 ELSE 0.0 END) AS completion_rate,
        MIN(a.rating) AS min_rating,
        MAX(a.rating) AS max_rating
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND s.group_id = ?
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
      SELECT a.anime_title, a.rating, m2.name AS assigner_name
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      JOIN members m2 ON a.assigner_id = m2.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
      ORDER BY a.rating DESC LIMIT 1
    `).get(m.id, req.groupId);

    const worst = db.prepare(`
      SELECT a.anime_title, a.rating, m2.name AS assigner_name
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      JOIN members m2 ON a.assigner_id = m2.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND s.group_id = ?
      ORDER BY a.rating ASC LIMIT 1
    `).get(m.id, req.groupId);

    const tasteRows = db.prepare(`
      SELECT a.rating, a.anilist_data FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE a.assignee_id = ? AND a.rating IS NOT NULL AND a.anilist_data IS NOT NULL AND s.group_id = ?
    `).all(m.id, req.groupId);

    const ratingsOverTime = db.prepare(`
      SELECT s.id AS season_id, s.name AS season_name,
        AVG(CASE WHEN a.assignee_id = ? THEN a.rating END) AS avg_received,
        AVG(CASE WHEN a.assigner_id = ? THEN a.rating END) AS avg_given
      FROM assignments a
      JOIN rolls r ON a.roll_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE s.group_id = ? AND a.rating IS NOT NULL
        AND (a.assignee_id = ? OR a.assigner_id = ?)
      GROUP BY s.id
      ORDER BY s.id ASC
    `).all(m.id, m.id, req.groupId, m.id, m.id);

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
      ratings_over_time: ratingsOverTime,
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
    SELECT r.id, r.roll_number, r.roll_date, r.title,
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

// GET /api/stats/ratings-over-time/:memberId
router.get('/ratings-over-time/:memberId', (req, res) => {
  const received = db.prepare(`
    SELECT r.id AS roll_id, r.roll_number, s.id AS season_id, s.name AS season_name,
      a.rating, a.anime_title
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    WHERE a.assignee_id = ? AND s.group_id = ? AND a.rating IS NOT NULL
    ORDER BY s.id ASC, r.roll_number ASC
  `).all(req.params.memberId, req.groupId);

  const given = db.prepare(`
    SELECT r.id AS roll_id, r.roll_number, s.id AS season_id, s.name AS season_name,
      a.rating, a.anime_title, ass.name AS assignee_name
    FROM assignments a
    JOIN rolls r ON a.roll_id = r.id
    JOIN seasons s ON r.season_id = s.id
    JOIN members ass ON a.assignee_id = ass.id
    WHERE a.assigner_id = ? AND s.group_id = ? AND a.rating IS NOT NULL
    ORDER BY s.id ASC, r.roll_number ASC
  `).all(req.params.memberId, req.groupId);

  const seasons = db.prepare(
    'SELECT DISTINCT id, name FROM seasons WHERE group_id = ? ORDER BY id ASC'
  ).all(req.groupId);

  res.json({ received, given, seasons });
});

export default router;