import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { searchAnime, formatAnimeData } from '../services/anilist.js';

const router = Router();

const animeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);
router.use(animeLimiter);

// GET /api/anime/search?q=title
router.get('/search', async (req, res) => {
  const q = req.query.q?.trim();

  if (!q) {
    return res.status(400).json({ error: 'q is required' });
  }

  if (q.length > 100) {
    return res.status(400).json({ error: 'Search query is too long' });
  }

  try {
    const results = await searchAnime(q);
    res.json(results.map(formatAnimeData));
  } catch (e) {
    console.error('Anime search error:', e);
    res.status(500).json({ error: 'Anime search failed' });
  }
});

router.post('/anilist-proxy', async (req, res) => {
  const { query, variables } = req.body ?? {};

  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  if (query.length > 5000) {
    return res.status(400).json({ error: 'Query is too long' });
  }

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: variables ?? {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'AniList request failed',
        details: data,
      });
    }

    res.json(data);
  } catch (err) {
    console.error('AniList proxy error:', err);
    res.status(500).json({ error: 'AniList proxy failed' });
  }
});

export default router;