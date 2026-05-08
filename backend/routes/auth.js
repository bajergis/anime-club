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
  const member = db.prepare(`
    SELECT m.id, m.name, m.anilist_username, m.avatar_url, m.group_id,
           g.name AS group_name, g.owner_id
    FROM members m
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE m.id = ?
  `).get(req.session.memberId);
  res.json(member);
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get("/callback", async (req, res) => {
  console.log("Callback hit:", {
    code: req.query.code?.slice(0, 8) + "...",
    ip: req.ip,
    headers: req.headers,
  });
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "No code provided" });
  console.log("Token exchange:", {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET ? `${CLIENT_SECRET.slice(0, 4)}...` : "MISSING",
    redirect_uri: REDIRECT_URI,
  });
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

  const member = db.prepare("SELECT * FROM members WHERE anilist_username = ?").get(viewer.name);

  // ── CLOSED REGISTRATION ──────────────────────────────────────────────────
  // If this AniList user has no matching member row, they're not in any group.
  // We don't auto-create accounts — redirect to a "not invited" page instead.
  if (!member) {
    console.log(`Login attempt by unknown AniList user: ${viewer.name} (${viewer.id})`);
    return res.redirect(`${process.env.FRONTEND_URL}/not-invited`);
  }

  db.prepare(`
    UPDATE members SET anilist_token = ?, anilist_id = ?, avatar_url = ? WHERE id = ?
  `).run(tokenRes.access_token, viewer.id, viewer.avatar?.large, member.id);

  db.prepare(`
    INSERT INTO users (id, anilist_id, anilist_token, username, avatar_url)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      anilist_token = excluded.anilist_token,
      avatar_url    = excluded.avatar_url
  `).run(
    `anilist:${viewer.id}`,
    viewer.id,
    tokenRes.access_token,
    viewer.name,
    viewer.avatar?.large,
  );

  req.session.memberId  = member.id;
  req.session.memberName = member.name;
  req.session.groupId   = member.group_id;  // null if not in a group yet

  req.session.save(err => {
    if (err) {
      console.error("Session save failed:", err);
      return res.status(500).json({ error: "Session save failed" });
    }
    console.log(`Login: ${viewer.name} → member ${member.id}, group ${member.group_id}`);
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  });
});

export default router;