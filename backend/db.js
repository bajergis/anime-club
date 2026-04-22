import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/anime-club.db"
  : "./data/anime-club.db"

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    anilist_username TEXT,
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

  -- Each assignment: member A was assigned to watch anime X, chosen by member B
  CREATE TABLE IF NOT EXISTS assignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_id         INTEGER REFERENCES rolls(id),
    assignee_id     TEXT REFERENCES members(id),   -- who watches it
    assigner_id     TEXT REFERENCES members(id),   -- who picked it
    anime_title     TEXT NOT NULL,
    anilist_id      INTEGER,                        -- AniList media ID (cached lookup)
    anilist_data    TEXT,                           -- JSON blob of AniList metadata
    rating          REAL,
    episodes_watched INTEGER,
    total_episodes   INTEGER,
    status          TEXT DEFAULT 'pending',         -- pending | watching | completed | dropped | hiatus
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS derangement_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id  INTEGER REFERENCES seasons(id),
    roll_id    INTEGER REFERENCES rolls(id),
    result     TEXT NOT NULL,   -- JSON: { "Jsn": "Dim", "Dim": "Olx", ... }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_assignments_roll ON assignments(roll_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_rolls_season ON rolls(season_id);
`);
