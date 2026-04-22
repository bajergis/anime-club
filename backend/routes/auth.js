import express from "express";
import { db } from "../db.js";

const router = express.Router();

const CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET;
const REDIRECT_URI = process.env.ANILIST_REDIRECT_URI;

// Step 1: redirect user to AniList login
router.get("/anilist", (req, res) => {
  const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  res.redirect(url);
});

router.get("/me", (req, res) => {
  if (!req.session.memberId) return res.status(401).json({ error: "Not logged in" });
  const member = db.prepare("SELECT id, name, anilist_username, avatar_url FROM members WHERE id = ?")
    .get(req.session.memberId);
  res.json(member);
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Step 2: AniList redirects back here with ?code=
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "No code provided" });

  // exchange code for token
  const tokenRes = await fetch("https://anilist.co/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  }).then(r => r.json());

  if (!tokenRes.access_token) {
    console.error("Token exchange failed:", tokenRes);
    return res.status(500).json({ error: "Token exchange failed" });
  }

  // fetch their AniList profile to identify who this is
  const profileRes = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenRes.access_token}`,
    },
    body: JSON.stringify({
      query: `query { Viewer { id name avatar { large } } }`,
    }),
  }).then(r => r.json());

  const viewer = profileRes.data?.Viewer;
  if (!viewer) return res.status(500).json({ error: "Could not fetch AniList profile" });

  // upsert member row by anilist_username
  const existing = db.prepare("SELECT * FROM members WHERE anilist_username = ?").get(viewer.name);

  if (existing) {
    db.prepare(`
      UPDATE members SET anilist_token = ?, anilist_id = ?, avatar_url = ? WHERE id = ?
    `).run(tokenRes.access_token, viewer.id, viewer.avatar?.large, existing.id);
  } else {
    // new member — create them
    db.prepare(`
      INSERT INTO members (id, name, anilist_username, anilist_token, anilist_id, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(viewer.name.toLowerCase(), viewer.name, viewer.name, tokenRes.access_token, viewer.id, viewer.avatar?.large);
  }

  // redirect to frontend with their member id so the app knows who logged in
  const member = db.prepare("SELECT * FROM members WHERE anilist_username = ?").get(viewer.name);
  req.session.memberId = member.id;
  req.session.memberName = member.name;
  res.redirect({process.env.FRONTEND_URL || "http://localhost:5173");
});

export default router;