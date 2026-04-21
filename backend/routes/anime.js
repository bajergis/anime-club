import { Router } from 'express';
import { searchAnime, formatAnimeData } from '../services/anilist.js';

const router = Router();

// GET /api/anime/search?q=title
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });
  try {
    const results = await searchAnime(q);
    res.json(results.map(formatAnimeData));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/anilist-proxy", async (req, res) => {
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    console.log("AniList proxy response:", JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;