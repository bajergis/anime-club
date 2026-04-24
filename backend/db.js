import Database from 'better-sqlite3';
import { statSync, existsSync } from 'fs';

const DB_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/anime-club.db"
  : "./data/anime-club.db";

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Opening DB at:", DB_PATH);
console.log("DB exists:", existsSync(DB_PATH));
if (existsSync(DB_PATH)) {
  console.log("DB size:", statSync(DB_PATH).size);
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    anilist_username TEXT,
    anilist_token TEXT,
    anilist_id INTEGER,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    started_at  DATE,
    ended_at    DATE,
    is_active   BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rolls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id   INTEGER REFERENCES seasons(id),
    roll_number INTEGER NOT NULL,
    roll_date   DATE,
    UNIQUE(season_id, roll_number)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_id         INTEGER REFERENCES rolls(id),
    assignee_id     TEXT REFERENCES members(id),
    assigner_id     TEXT REFERENCES members(id),
    anime_title     TEXT NOT NULL,
    anilist_id      INTEGER,
    anilist_data    TEXT,
    rating          REAL,
    episodes_watched INTEGER,
    total_episodes   INTEGER,
    status          TEXT DEFAULT 'pending',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS derangement_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id  INTEGER REFERENCES seasons(id),
    roll_id    INTEGER REFERENCES rolls(id),
    result     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_assignments_roll ON assignments(roll_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_rolls_season ON rolls(season_id);
`);

// Migrations — safe to run on every startup
try {
  db.prepare(`ALTER TABLE seasons ADD COLUMN roll_count INTEGER`).run();
  console.log("Migration applied: seasons.roll_count added");
} catch {
}