# AniRoll

A full-stack web application for tracking a friend group's anime assignment rotation — built as a portfolio project demonstrating application design.

**Live:** `https://aniroll.co` &nbsp;|&nbsp; **Stack:** Node.js · React · SQLite · Railway · GitHub Actions

---

## What It Does

Each roll, a weighted derangement algorithm assigns every participating member to pick an anime for exactly one other person — nobody picks for themselves. Members lock in to a roll lobby, the group owner generates assignments, each assigner picks a show from their assignee's AniList planning list (or searches AniList directly), and once all picks are submitted the roll goes live. Members then track progress, rate shows, and the app surfaces stats like:

- Per-member average ratings and taste profiles vs AniList community scores
- Head-to-head matrix: how does each person rate shows picked by each other person
- Genre affinity breakdown across seasons
- Season best/worst shows and averages
- Completion/drop rates per member
- Group insights: best taste, hardest to please, best taste alignment, longest streak

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Railway Service                                            │
│                                                             │
│  Express + SQLite (serves React frontend as static files)  │
│  /app/data/anime-club.db  (PVC)                            │
│  /app/data/sessions.db    (session store)                  │
└─────────────────────────────────────────────────────────────┘
         │                         │
    AniList GraphQL API        GitHub Actions CI/CD
    (external)                 build frontend → deploy
```

### Key Design Decisions

**SQLite over Postgres** — Small fixed user base, write volume is extremely low. SQLite in WAL mode on a Railway PVC is simpler and cheaper.

**Single Railway service** — Frontend is built at deploy time and served as static files by Express. This avoids cross-domain cookie issues with session auth.

**AniList OAuth for auth** — Members log in via AniList. The callback upserts a `users` row and sets a session. Three auth states exist: `member` (in a group), `no_group` (logged in, no group yet), and unauthenticated. Banned users are redirected to `/login?banned=1` at the OAuth callback.

**Groups model** — All data (seasons, members, assignments) is scoped to a `group_id`. The middleware chain is `requireAuth → requireGroupMember`. Cross-group data access is impossible at the query level.

**Weighted derangement** — Roll assignments use a two-tier weighted algorithm. Season-level pair history (strength 1.5) is corrected more aggressively than long-term historical drift (strength 0.3).

**Roll lifecycle** — Rolls have four states: `drafting` (lock-in lobby) → `selecting` (blind picks from planning lists) → `active` (roll revealed, watching in progress) → `completed`.

---

## Database Schema

```sql
-- Auth and groups
users (id TEXT PK, anilist_id, anilist_token, username, avatar_url, banned_at, ban_reason, created_at)
groups (id INTEGER PK, name, owner_id → users.id, created_at)
group_members (group_id → groups.id, user_id → users.id, joined_at)
group_invites (id, token UNIQUE, group_id, created_by, expires_at, used_at, used_by)
join_requests (id, group_id, user_id, anilist_username, avatar_url, requested_at, status)

-- Core data
members (id TEXT PK, name, anilist_username, avatar_url, anilist_token, anilist_id, group_id, user_id, created_at)
seasons (id, name, started_at, ended_at, is_active, group_id, roll_count)
rolls (id, season_id, roll_number, roll_date, state, title)
assignments (id, roll_id, assignee_id, assigner_id, anime_title, anilist_id, anilist_data, rating, episodes_watched, total_episodes, status, notes, created_at, updated_at)

-- Roll lifecycle
roll_readiness (roll_id, member_id, locked_at)
roll_selections (id, roll_id, assigner_id, assignee_id, anime_title, anilist_id, anilist_data, selected_at)
derangement_history (id, season_id, roll_id, result JSON, created_at)

-- Marathons
marathons (id, group_id, name, description, created_by, status, started_at, ended_at, created_at)
marathon_entries (id, marathon_id, position, anime_title, anilist_id, anilist_data, added_by, status, watched_at, created_at)
marathon_locks (id, entry_id, member_id, locked_at, showed_up, rating, anilist_status, synced_at)
```

Key notes:
- `members.id` uses short text PKs (`"jsn"`, `"olx"`) for legacy reasons. New members use their AniList username as ID.
- `rolls.state` — `drafting | selecting | active | completed`
- `rolls.title` — optional theme/title per roll
- `seasons.roll_count NULL` means unlimited rolls for that season
- `users.banned_at` and `users.ban_reason` — set by superadmin to block a user at OAuth callback

---

## Roll Flow

1. **Seasons page** — owner clicks "Create Roll Lobby" → roll created in `drafting` state, navigates to `/roll/:id`
2. **Roll page (drafting)** — members click "Lock In"; owner sees readiness list polled every 3s. Owner can "Generate Assignments" or "Force Start — Pick Members"
3. **Roll page (selecting)** — each assigner sees their assignee's AniList planning list. Picks are blind. Auto-reveals when all done.
4. **Roll page (active)** — assignments revealed, watching/rating flow. AniList progress and scores sync on load.
5. **Roll page (completed)** — same as active, read-only.

---

## Marathon Flow

1. Owner creates a marathon from the Marathons page and adds anime entries
2. Owner sets one entry as active
3. Members lock in to the active entry
4. Owner marks the entry done — AniList ratings are synced for all locked-in members
5. Owner can toggle no-shows and manually edit ratings for backfill
6. Owner controls entry order via reorder controls on the Marathon detail page

---

## Groups & Invites Flow

1. New user logs in via AniList → lands on `/no-group`
2. Options: **Create a group** (become owner), **Enter invite code**, **Search for a group**
3. Owner can generate invite links (48hr expiry, one-time use) from `/group`
4. Anyone can search groups and send a join request; owner accepts/rejects from `/group`
5. `/join?token=` — shareable invite link; works pre-login (token stored in sessionStorage through AniList OAuth flow)

---

## API Reference

### Assignments
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/assignments` | List (filter: `season_id`, `roll_id`, `member_id`, `assigner_id`) |
| `POST` | `/api/assignments` | Create; auto-fetches AniList metadata |
| `PATCH`| `/api/assignments/:id` | Update rating, episodes, status, notes (notes are assignee-only) |
| `DELETE`| `/api/assignments/:id` | Delete assignment |
| `POST` | `/api/assignments/:id/refresh-anilist` | Re-fetch AniList data |
| `POST` | `/api/assignments/bulk-refresh-anilist?season_id=` | Backfill AniList data; streams SSE progress |

### Seasons
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/seasons` | List all seasons for group |
| `GET`  | `/api/seasons/active` | Active season + rolls + `currentRollState` |
| `POST` | `/api/seasons` | Create season |
| `PATCH`| `/api/seasons/:id` | Edit name, dates, active status, roll_count |
| `GET`  | `/api/seasons/:id/rolls` | List rolls for a season |
| `DELETE`| `/api/seasons/:id/rolls/:rollId` | Remove a roll and its assignments |
| `POST` | `/api/seasons/:id/rolls` | Create roll in `drafting` state; accepts optional `title` |

### Rolls
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/rolls/:id` | Roll metadata |
| `GET`  | `/api/rolls/:id/status` | Live state: readiness, selections, derangement |
| `POST` | `/api/rolls/:id/lock-in` | Lock in for this roll |
| `DELETE`| `/api/rolls/:id/lock-in` | Un-ready (drafting only) |
| `POST` | `/api/rolls/:id/generate` | Owner: run derangement, move to selecting |
| `POST` | `/api/rolls/:id/select` | Submit anime pick; auto-reveals when all done |
| `PATCH`| `/api/rolls/:id/state` | Owner: manual state override |
| `PATCH`| `/api/rolls/:id/title` | Owner: set or update roll title |

### Marathons
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/marathons` | List marathons for group |
| `POST` | `/api/marathons` | Create a marathon |
| `GET`  | `/api/marathons/:id` | Marathon detail with entries and lock grid |
| `PATCH`| `/api/marathons/:id` | Update marathon (name, description, status) |
| `DELETE`| `/api/marathons/:id` | Delete marathon |
| `POST` | `/api/marathons/:id/entries` | Add an entry to a marathon |
| `PATCH`| `/api/marathons/:id/entries/:entryId` | Update entry (status, position, watched_at) |
| `DELETE`| `/api/marathons/:id/entries/:entryId` | Remove an entry |
| `POST` | `/api/marathons/:id/entries/:entryId/lock` | Lock in to an entry |
| `DELETE`| `/api/marathons/:id/entries/:entryId/lock` | Remove lock |
| `POST` | `/api/marathons/:id/entries/:entryId/sync` | Sync AniList ratings for all locked-in members |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/groups/search?q=` | Public group search |
| `GET`  | `/api/groups/join?token=` | Validate invite token, return group info |
| `POST` | `/api/groups` | Create a group (becomes owner) |
| `POST` | `/api/groups/join` | Consume invite token and join group |
| `GET`  | `/api/groups/:id` | Public group profile |
| `POST` | `/api/groups/:id/invite` | Owner: generate invite token |
| `POST` | `/api/groups/:id/request` | Request to join group |
| `GET`  | `/api/groups/:id/requests` | Owner: list pending join requests |
| `PATCH`| `/api/groups/:id/requests/:userId` | Owner: accept or reject request |
| `DELETE`| `/api/groups/:id/members/:memberId` | Owner: remove a member |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/stats/overview` | Group totals + insights (best taste, hardest to please, alignment, streak) |
| `GET`  | `/api/stats/members` | Per-member stats, genre affinity, taste offset, ratings over time |
| `GET`  | `/api/stats/season/:id` | Season-level breakdown |
| `GET`  | `/api/stats/head-to-head` | Assigner→assignee rating matrix |
| `GET`  | `/api/stats/ratings-over-time/:memberId` | Per-roll ratings for chart |

### Superadmin
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/superadmin/stats` | Site-wide stats |
| `GET`  | `/api/superadmin/groups` | All groups with full member detail |
| `POST` | `/api/superadmin/users/:id/ban` | Ban a user (sets `banned_at`, `ban_reason`) |
| `POST` | `/api/superadmin/users/:id/unban` | Unban a user |
| `POST` | `/api/superadmin/members/:id/reassign` | Move a member to a different group |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/members` | Group members |
| `GET/PATCH` | `/api/members/:id` | Member detail / update |
| `GET`  | `/api/anime/search?q=` | AniList search proxy |
| `POST` | `/api/anime/anilist-proxy` | Raw AniList GraphQL proxy |
| `GET`  | `/auth/me` | Current session — returns `{ state, ...member }` |
| `GET`  | `/auth/anilist` | Start AniList OAuth flow |
| `GET`  | `/auth/callback` | AniList OAuth callback |
| `POST` | `/auth/logout` | Destroy session |
| `GET`  | `/health` | Liveness probe |

---

## Auth Flow

1. User hits `/auth/anilist` → redirected to AniList OAuth
2. AniList redirects to `/auth/callback?code=` → server exchanges code for token, fetches AniList profile
3. `users` table upserted regardless of membership status
4. If user is banned → redirect to `/login?banned=1`
5. If `anilist_username` matches an existing `members` row → session set, redirect to frontend
6. If no match → `userId`, `anilistUsername`, `avatarUrl` stored in session, redirect to `/no-group`

Session cookie is `httpOnly`, `secure` in production, `sameSite: lax`. All API fetches must include `credentials: "include"`. Sessions expire after 7 days.

### Auth States

```js
// member === undefined → still loading
// authState === 'member' → logged in with group, full access
// authState === 'no_group' → logged in, no group yet → /no-group
// member === null → not logged in → /login
const { member, authState, logout, authBase } = useAuth();
```

---

## Middleware

Located at `backend/middleware/`:

- `auth.js`
  - `requireAuth` — rejects 401 if no `req.session.userId`; sets `req.userId` and `req.groupId`
  - `requireGroupMember` — verifies membership; derives `groupId` from DB rather than trusting session
- `superadmin.js`
  - `requireSuperAdmin` — checks session `userId` against `ADMIN_USER_IDS` env var

---

## Frontend Structure

```
src/
├── main.jsx
├── App.jsx                ← Nav, ProtectedRoute, LoginPage, NoGroupPage, JoinPage
├── lib/
│   ├── AuthContext.jsx    ← useAuth() hook
│   └── anilistSync.js    ← shared AniList sync utility (used by Dashboard, Season, Roll)
└── pages/
    ├── Dashboard.jsx
    ├── Seasons.jsx
    ├── Season.jsx         ← collapsible roll panels with optional title display
    ├── Roll.jsx           ← DraftingView | SelectingView | ActiveView
    ├── Marathon.jsx       ← detail page: entries, lock grid, owner controls
    ├── Marathons.jsx      ← list page with progress bars, dates, create form
    ├── Member.jsx
    ├── Stats.jsx          ← Recharts line/bar charts, group insights
    ├── GroupManage.jsx    ← member list, join requests, invite link generator
    └── SuperAdmin.jsx     ← site-wide admin (gated by VITE_ADMIN_USER_IDS)
```

Nav links: Dashboard `⊞`, Group `⊛`, Seasons `◉`, Marathons `⧖`, Stats `◈`, Admin `⌬` (superadmin only)

---

## Getting Started

### Local Development

```bash
# Clone
git clone https://github.com/youruser/anime-club
cd anime-club

# Backend
cd backend
npm install
mkdir -p data
cp .env.example .env
npm run dev            # starts on :3001

# Frontend (separate terminal)
cd ../frontend
npm install
npm run dev            # starts on :5173
```

### Environment Variables

**backend/.env**

```
NODE_ENV=development
PORT=3001
SESSION_SECRET=<long random string>
FRONTEND_URL=http://localhost:5173
ANILIST_CLIENT_ID=<from anilist.co/settings/developer>
ANILIST_CLIENT_SECRET=<from anilist.co/settings/developer>
ANILIST_REDIRECT_URI=http://localhost:3001/auth/callback
ADMIN_USER_IDS=<comma-separated AniList user IDs for superadmin access>
```

**frontend/.env.local**

```
VITE_ADMIN_USER_IDS=<comma-separated AniList user IDs, must match backend>
```

Both `ADMIN_USER_IDS` and `VITE_ADMIN_USER_IDS` must also be set as Railway Variables in production.

**Important:** AniList only allows one redirect URI per app. Create a separate AniList app for local dev.

### Database Setup

```bash
sqlite3 ./data/anime-club.db < migrate.sql
sqlite3 ./data/anime-club.db < migrate_marathons.sql
sqlite3 ./data/anime-club.db < migrate_marathons_v2.sql
sqlite3 ./data/anime-club.db < migrate_superadmin.sql
```

### Production Deploy (Railway)

Push to `main` — GitHub Actions handles the rest. `railway.toml` at repo root configures the build and start commands.

---

## Project Structure

```
anime-club/
├── railway.toml
├── .github/workflows/deploy.yml
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── migrate.sql
│   ├── migrate_marathons.sql
│   ├── migrate_marathons_v2.sql
│   ├── migrate_superadmin.sql
│   ├── middleware/
│   │   ├── auth.js
│   │   └── superadmin.js
│   ├── routes/
│   │   ├── anime.js
│   │   ├── assignments.js
│   │   ├── auth.js
│   │   ├── groups.js
│   │   ├── marathons.js
│   │   ├── members.js
│   │   ├── rolls.js
│   │   ├── seasons.js
│   │   ├── stats.js
│   │   └── superadmin.js
│   └── services/
│       ├── anilist.js
│       └── derangement.js
└── frontend/
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── lib/
        │   ├── AuthContext.jsx
        │   └── anilistSync.js
        └── pages/
```

---

## Known Quirks

- **Members table uses text IDs** (`"jsn"`, `"olx"`) — legacy PKs from before the auth system
- **Avatar URLs** stored on both `members` and `users` — `members.avatar_url` is what the frontend uses
- **AniList sync** runs on Dashboard and Season page load (not just Roll page). Sync also pulls scores (`POINT_10_DECIMAL`). Ratings from AniList are non-destructive — manual ratings won't be overwritten by null. If AniList status is `COMPLETED` but `progress < total_episodes`, `total_episodes` is used instead.
- **`roll_count` null** means unlimited rolls for that season
- **SQLite string literals** must use single quotes in SQL — double quotes are identifiers in SQLite
- **`req.session.save()`** must be called explicitly before redirects after setting session values
- **`k8s/` directory** exists in repo but is unused — app runs on Railway. Safe to delete.
- **`Admin.jsx`** (original admin page) still needs `requireAdmin` middleware applied to its backend routes before the app goes fully public
- **`/login?banned=1`** redirect is wired in the backend but the login page doesn't yet render a banned message — `LoginPage` in `App.jsx` should check `useSearchParams` for `banned=1`