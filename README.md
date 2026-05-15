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

**AniList OAuth for auth** — Members log in via AniList. The callback upserts a `users` row and sets a session. Three auth states exist: `member` (in a group), `no_group` (logged in, no group yet), and unauthenticated.

**Groups model** — All data (seasons, members, assignments) is scoped to a `group_id`. The middleware chain is `requireAuth → requireGroupMember`. Cross-group data access is impossible at the query level.

**Weighted derangement** — Roll assignments use a two-tier weighted algorithm. Season-level pair history (strength 1.5) is corrected more aggressively than long-term historical drift (strength 0.3).

**Roll lifecycle** — Rolls have four states: `drafting` (lock-in lobby) → `selecting` (blind picks from planning lists) → `active` (roll revealed, watching in progress) → `completed`.

---

## Database Schema

```sql
-- Auth and groups
users (id TEXT PK, anilist_id, anilist_token, username, avatar_url, created_at)
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
```

Key notes:
- `members.id` uses short text PKs (`"jsn"`, `"olx"`) for legacy reasons. New members use their AniList username as ID.
- `rolls.state` — `drafting | selecting | active | completed`
- `rolls.title` — optional theme/title per roll
- `seasons.roll_count NULL` means unlimited rolls for that season

---

## Roll Flow

1. **Seasons page** — owner clicks "Create Roll Lobby" → roll created in `drafting` state, navigates to `/roll/:id`
2. **Roll page (drafting)** — members click "Lock In"; owner sees readiness list polled every 3s. Owner can "Generate Assignments" or "Force Start — Pick Members"
3. **Roll page (selecting)** — each assigner sees their assignee's AniList planning list. Picks are blind. Auto-reveals when all done.
4. **Roll page (active)** — assignments revealed, watching/rating flow. AniList progress syncs on load.
5. **Roll page (completed)** — same as active, read-only.

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
| `PATCH`| `/api/assignments/:id` | Update rating, episodes, status, notes |
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
4. If `anilist_username` matches an existing `members` row → session set, redirect to frontend
5. If no match → `userId`, `anilistUsername`, `avatarUrl` stored in session, redirect to `/no-group`

Session cookie is `httpOnly`, `secure` in production, `sameSite: lax`. All API fetches must include `credentials: "include"`.

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

Located at `backend/middleware/auth.js`:

- `requireAuth` — rejects 401 if no `req.session.userId`
- `requireGroupMember` — verifies `req.session.groupId` membership; sets `req.groupId`

---

## Frontend Structure

```
src/
├── main.jsx
├── App.jsx                ← Nav, ProtectedRoute, LoginPage, NoGroupPage, JoinPage
├── lib/AuthContext.jsx    ← useAuth() hook
└── pages/
    ├── Dashboard.jsx
    ├── Seasons.jsx
    ├── Season.jsx         ← collapsible roll panels with optional title display
    ├── Roll.jsx           ← DraftingView | SelectingView | ActiveView
    ├── Member.jsx
    ├── Stats.jsx          ← Recharts line/bar charts, group insights
    └── GroupManage.jsx    ← member list, join requests, invite link generator
```

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

### Environment Variables (backend .env)

```
NODE_ENV=development
PORT=3001
SESSION_SECRET=<long random string>
FRONTEND_URL=http://localhost:5173
ANILIST_CLIENT_ID=<from anilist.co/settings/developer>
ANILIST_CLIENT_SECRET=<from anilist.co/settings/developer>
ANILIST_REDIRECT_URI=http://localhost:3001/auth/callback
```

**Important:** AniList only allows one redirect URI per app. Create a separate AniList app for local dev.

### Database Setup

```bash
sqlite3 ./data/anime-club.db < migrate.sql
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
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── anime.js
│   │   ├── assignments.js
│   │   ├── auth.js
│   │   ├── groups.js
│   │   ├── members.js
│   │   ├── rolls.js
│   │   ├── seasons.js
│   │   └── stats.js
│   └── services/
│       ├── anilist.js
│       └── derangement.js
├── frontend/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/AuthContext.jsx
│       └── pages/
└── k8s/
    ├── base/
    └── overlays/dev + prod
```

---

## Known Quirks

- **Members table uses text IDs** (`"jsn"`, `"olx"`) — legacy PKs from before the auth system
- **Avatar URLs** stored on both `members` and `users` — `members.avatar_url` is what the frontend uses
- **AniList sync** in `ActiveView` runs on mount — comment out sync block when testing locally
- **`roll_count` null** means unlimited rolls for that season
- **SQLite string literals** must use single quotes in SQL — double quotes are identifiers in SQLite
- **`req.session.save()`** must be called explicitly before redirects after setting session values