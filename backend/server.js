import express from 'express';
import session from "express-session";
import "dotenv/config";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import assignmentsRouter from './routes/assignments.js';
import animeRouter from './routes/anime.js';
import membersRouter from './routes/members.js';
import seasonsRouter from './routes/seasons.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import { db } from './db.js';
import connectSqlite3 from "connect-sqlite3";
import rollsRouter from './routes/rolls.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQLiteStore = connectSqlite3(session);
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

const DB_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/anime-club.db"
  : "./data/anime-club.db";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "*.anilist.co", "*.anilistcdn.net"],
      connectSrc: ["'self'", "https://graphql.anilist.co", "https://anilist.co"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(session({
  store: new SQLiteStore({
    db: "sessions.db",
    dir: process.env.NODE_ENV === "production" ? "/app/data" : "./data",
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  }
}));

app.use('/api/assignments', assignmentsRouter);
app.use('/api/anime', animeRouter);
app.use('/api/members', membersRouter);
app.use('/api/rolls', rollsRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/stats', statsRouter);
app.use('/auth', authRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Serve frontend ────────────────────────────────────────────────────────────
const frontendPath = join(__dirname, '../frontend/dist');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`API running on :${PORT}`));
export default app;