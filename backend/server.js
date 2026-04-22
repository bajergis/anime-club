import express from 'express';
import session from "express-session";
import "dotenv/config";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { statSync, readdirSync, writeFileSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

import assignmentsRouter from './routes/assignments.js';
import animeRouter from './routes/anime.js';
import membersRouter from './routes/members.js';
import seasonsRouter from './routes/seasons.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';

// import db — we keep a mutable reference so we can reopen after upload
import { db } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

const DB_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/anime-club.db"
  : "./data/anime-club.db";

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  }
}));

app.use('/api/assignments', assignmentsRouter);
app.use('/api/anime', animeRouter);
app.use('/api/members', membersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/stats', statsRouter);
app.use('/auth', authRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Temp admin endpoints (remove after setup) ────────────────────────────────

app.get("/admin/db-check", (req, res) => {
  try {
    const files = readdirSync("/app/data");
    const stat = statSync(DB_PATH);
    writeFileSync("/app/data/test.txt", "hello");
    res.json({ files, size: stat.size, modified: stat.mtime, volumeWritable: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get("/admin/db-contents", (req, res) => {
  try {
    const members = db.prepare("SELECT * FROM members").all();
    const seasons = db.prepare("SELECT * FROM seasons").all();
    const assignments = db.prepare("SELECT COUNT(*) as count FROM assignments").get();
    const stat = statSync(DB_PATH);
    res.json({ members, seasons, assignmentCount: assignments.count, dbSize: stat.size, dbModified: stat.mtime });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/admin/upload-db", async (req, res) => {
  try {
    // close existing connection so the file isn't locked during write
    db.close();

    // stream upload into the db file
    const dest = createWriteStream(DB_PATH);
    await pipeline(req, dest);

    // reopen and verify
    const fresh = new Database(DB_PATH);
    fresh.pragma('journal_mode = WAL');
    fresh.pragma('foreign_keys = ON');
    const members = fresh.prepare("SELECT * FROM members").all();
    fresh.close();

    res.json({ ok: true, memberCount: members.length, message: "Restart the service now to apply the new DB." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`API running on :${PORT}`));
export default app;