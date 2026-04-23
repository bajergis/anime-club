import Database from 'better-sqlite3';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH  = path.join(__dirname, 'data', 'anime-club.db');
const XLS_PATH = path.join(__dirname, '..', 'Bois_Anime.xlsx');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import fs from 'fs';
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const { db } = await import('./db.js');

db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA foreign_key_check;");

const fkErrors = db.prepare("PRAGMA foreign_key_check").all();
console.log(fkErrors);

// ── Members ────────────────────────────────────────────────────
const MEMBERS = [
  { id: 'jsn',  name: 'Jsn' },
  { id: 'olx',  name: 'Olx' },
  { id: 'drnz', name: 'Drnz' },
  { id: 'dim',  name: 'Dim' },
  { id: 'hdrk', name: 'Hdrk' },
];

const upsertMember = db.prepare(
  'INSERT OR IGNORE INTO members (id, name) VALUES (?, ?)'
);
for (const m of MEMBERS) upsertMember.run(m.id, m.name);
console.log('✓ Members seeded');

const wb = xlsx.readFile(XLS_PATH);

const SEASON_SHEETS = [
  {
    sheet: 'Season 1', name: 'Season 1', start: '2020-11-17',
    cols: [
      { id: 'jsn',  tc: 1, rc: 2 },
      { id: 'hdrk', tc: 3, rc: 4 },
      { id: 'olx',  tc: 5, rc: 6 },
      { id: 'drnz', tc: 7, rc: 8 },
      { id: 'dim',  tc: 9, rc: 10 },
    ],
  },
  {
    sheet: 'Season 2', name: 'Season 2', start: '2021-08-08',
    cols: [
      { id: 'jsn',  tc: 1, rc: 2 },
      { id: 'olx',  tc: 5, rc: 6 },
      { id: 'drnz', tc: 7, rc: 8 },
      { id: 'dim',  tc: 9, rc: 10 },
    ],
  },
  {
    sheet: 'Season 3', name: 'Season 3', start: '2022-11-06',
    cols: [
      { id: 'jsn',  tc: 1, rc: 2 },
      { id: 'olx',  tc: 5, rc: 6 },
      { id: 'drnz', tc: 7, rc: 8 },
      { id: 'dim',  tc: 9, rc: 10 },
    ],
  },
  {
    sheet: 'Season 3 Part 2', name: 'Season 3 Part 2', start: '2024-04-07',
    cols: [
      { id: 'jsn',  tc: 1, rc: 2 },
      { id: 'olx',  tc: 3, rc: 4 },
      { id: 'drnz', tc: 5, rc: 6 },
      { id: 'dim',  tc: 7, rc: 8 },
    ],
  },
  {
    sheet: 'Season 4', name: 'Season 4', start: '2026-04-12',
    cols: [
      { id: 'jsn',  tc: 1, rc: 2 },
      { id: 'olx',  tc: 3, rc: 4 },
      { id: 'drnz', tc: 5, rc: 6 },
      { id: 'dim',  tc: 7, rc: 8 },
    ],
  },
];

const insertSeason = db.prepare(
  'INSERT INTO seasons (name, started_at, is_active) VALUES (?, ?, ?)'
);
const insertRoll = db.prepare(
  'INSERT OR IGNORE INTO rolls (season_id, roll_number, roll_date) VALUES (?, ?, ?)'
);
const insertAssignment = db.prepare(`
  INSERT INTO assignments (roll_id, assignee_id, assigner_id, anime_title, rating, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function parseTitleCell(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { title: raw.trim(), assignerId: null };
  const title = match[1].trim();
  const assignerRaw = match[2].trim().toLowerCase();
  // fuzzy map short names
  const map = { jsn: 'jsn', olx: 'olx', drnz: 'drnz', dim: 'dim', hdrk: 'hdrk',
                 hnrk: 'hdrk', jay: 'jsn', tim: 'dim', timmay: 'dim',
                 aleksay: 'dim', terray: 'jsn', tom: 'olx' };
  return { title, assignerId: map[assignerRaw] || assignerRaw };
}

/** Parse date from "1. Woche (17.11.2020)" */
function parseRollDate(label) {
  const m = label?.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (!m) return null;
  const [d, mo, y] = m[1].split('.');
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function isSkipRow(label) {
  if (!label) return true;
  const s = String(label).toLowerCase();
  return s.includes('hiatus') || s.includes('average') || s.includes('average') ||
         s.includes('recommendation') || s.includes('ende') || s === 'nan';
}

for (let si = 0; si < SEASON_SHEETS.length; si++) {
  const cfg = SEASON_SHEETS[si];
  const isLast = si === SEASON_SHEETS.length - 1;

  const seasonResult = insertSeason.run(cfg.name, cfg.start, isLast ? 1 : 0);
  const seasonId = seasonResult.lastInsertRowid;

  const ws = wb.Sheets[cfg.sheet];
  if (!ws) { console.warn(`  ⚠ Sheet not found: ${cfg.sheet}`); continue; }
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  let rollNumber = 0;
  let skipped = 0;
  let imported = 0;

  for (const row of rows) {
    const label = row[0];
    if (isSkipRow(label)) { skipped++; continue; }

    const rollDate = parseRollDate(String(label));
    rollNumber++;

    const rollResult = insertRoll.run(seasonId, rollNumber, rollDate);
    const rollId = rollResult.lastInsertRowid || db.prepare(
      'SELECT id FROM rolls WHERE season_id = ? AND roll_number = ?'
    ).get(seasonId, rollNumber)?.id;

    for (const col of cfg.cols) {
      const rawTitle = row[col.tc];
      const rawRating = row[col.rc];

      const parsed = parseTitleCell(rawTitle);
      if (!parsed) continue;

      const skip = ['hiatus', 'keine teilnahme', 'hiatus x hiatus', 'hiatus in space']
        .some(s => parsed.title.toLowerCase().includes(s));
      if (skip) continue;

      const rating = typeof rawRating === 'number' ? rawRating : null;
      const status = rating != null ? 'completed' : 'pending';

      // assignee = the member in this column, assigner = extracted from title
      try {
        insertAssignment.run(
        rollId,
        col.id,
        parsed.assignerId || col.id,   // fallback: self (will be cleaned up)
        parsed.title,
        rating,
        status,
      );
      } catch (e) {
        console.error("Assignment insert failed: ", {
          rollId,
          assignee: col.id,
          assigner: parsed.assignerId,
          title: parsed.title,
          rating,
        });

        console.log(db.prepare("PRAGMA foreign_key_check").all());
        throw e;
      }
      imported++;
    }
  }
  console.log(`✓ ${cfg.name}: ${rollNumber} rolls, ${imported} assignments (${skipped} rows skipped)`);
}

console.log('\n✅ Seed complete. Run the API and check /api/stats/overview');
db.close();