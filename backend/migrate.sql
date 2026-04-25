-- =============================================================
-- MIGRATION: Add groups, users, scope members + seasons to group
-- Run with: sqlite3 your-database.db < migrate.sql
-- =============================================================

PRAGMA foreign_keys = OFF; -- disable temporarily while restructuring

BEGIN TRANSACTION;

-- -------------------------------------------------------------
-- 1. USERS
--    Separate from members intentionally — a user is who logs in,
--    a member is who participates in rolls. They're linked but not
--    the same thing (e.g. a future user might be in multiple groups).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,           -- reuse AniList ID as string, e.g. "anilist:12345"
  anilist_id    INTEGER UNIQUE,             -- AniList numeric ID
  anilist_token TEXT,                       -- OAuth access token
  username      TEXT NOT NULL,              -- AniList display name
  avatar_url    TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- 2. GROUPS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- 3. GROUP_MEMBERS  (who belongs to which group)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  group_id   INTEGER NOT NULL REFERENCES groups(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);

-- -------------------------------------------------------------
-- 4. GROUP_INVITES  (for later — stubbed now so the schema is ready)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL UNIQUE,          -- UUID, used in invite URL
  group_id   INTEGER NOT NULL REFERENCES groups(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,                      -- NULL = still valid
  used_by    TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- 5. ADD group_id TO members
--    members already exist, so we ALTER and backfill below
-- -------------------------------------------------------------
ALTER TABLE members ADD COLUMN group_id INTEGER REFERENCES groups(id);
ALTER TABLE members ADD COLUMN user_id  TEXT REFERENCES users(id);

-- -------------------------------------------------------------
-- 6. ADD group_id TO seasons
-- -------------------------------------------------------------
ALTER TABLE seasons ADD COLUMN group_id INTEGER REFERENCES groups(id);

-- -------------------------------------------------------------
-- 7. SEED: create your group and migrate existing data
--
--    Replace the values below with real ones:
--      YOUR_ANILIST_ID   → your numeric AniList ID
--      YOUR_ANILIST_NAME → your AniList username
--      YOUR_AVATAR_URL   → your AniList avatar URL (or NULL)
--
--    For each of your 5 existing members, add a row in the
--    INSERT INTO users block and a row in INSERT INTO group_members.
-- -------------------------------------------------------------

-- Your user (the owner)
INSERT OR IGNORE INTO users (id, anilist_id, username, avatar_url) VALUES
  ('anilist:131559', 131559, 'Bajergis', 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b131559-6Oqlg08lqR26.png'),
  ('anilist:725915', 725915, 'napcap', 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b725915-HvbzJPrM12Dr.png'),
  ('anilist:701526', 701526, 'Pr0gramm', 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b701526-IKwUaw14jFvm.png'),
  ('anilist:153854', 153854, 'FulminisIctus', 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b153854-wMrtHC412UIi.jpg'),
  ('anilist:817086', 817086, 'Beskar', 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b817086-ubpKlcs37Taw.jpg');

-- Create the group (you are the owner)
INSERT INTO groups (name, owner_id) VALUES ('Animu Bros', 'anilist:131559');

-- Capture the new group's id for backfilling
-- (SQLite doesn't support variables easily, so we use a subquery below)

-- Add everyone to group_members
INSERT INTO group_members (group_id, user_id)
SELECT g.id, u.id FROM groups g, users u
WHERE g.name = 'Animu Bros';  -- adjust if name changes

-- Link existing members rows to the group and their user
UPDATE members SET
  group_id = (SELECT id FROM groups WHERE name = 'Animu Bros'),
  user_id  = 'anilist:' || CAST(anilist_id AS TEXT)
WHERE anilist_id IS NOT NULL;

-- Scope all existing seasons to the group
UPDATE seasons SET
  group_id = (SELECT id FROM groups WHERE name = 'Animu Bros');

-- -------------------------------------------------------------
-- 8. INDEXES
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_group    ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_seasons_group    ON seasons(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_token ON group_invites(token);

COMMIT;

PRAGMA foreign_keys = ON;