# AniRoll

A full-stack web application for tracking a friend group's anime assignment rotation — built as a portfolio project demonstrating application design.

**Live:** `https://aniroll.co` &nbsp;|&nbsp; **Stack:** Node.js · React · SQLite · Kubernetes · GitHub Actions

---

## What It Does

Each roll, a weighted derangement algorithm assigns every participating member to pick an anime for exactly one other person — nobody picks for themselves. Members lock in to a roll lobby, the group owner generates assignments, each assigner picks a show from their assignee's AniList planning list (or searches AniList directly), and once all picks are submitted the roll goes live. Members then track progress, rate shows, and the app surfaces stats like:

- Per-member average ratings and taste profiles vs AniList community scores
- Head-to-head matrix: how does each person rate shows picked by each other person
- Genre affinity breakdown across seasons
- Season best/worst shows and averages
- Completion/drop rates per member

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster (anime-club namespace)                  │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │  Frontend Pod(s)  │        │    API Pod(s)             │  │
│  │  React + Nginx    │◄──────►│    Express + SQLite       │  │
│  │  (2 replicas)     │        │    (2–6 replicas, HPA)   │  │
│  └──────────────────┘        └──────────┬───────────────┘  │
│                                          │                   │
│  ┌───────────────────────────────────────▼───────────────┐  │
│  │  PersistentVolumeClaim  (anime-club-db-pvc, 1Gi)      │  │
│  │  SQLite WAL-mode database                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CronJob: daily SQLite → S3 backup at 3 AM UTC        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Ingress (nginx) + cert-manager TLS                         │
└─────────────────────────────────────────────────────────────┘
         │                         │
    AniList GraphQL API        GitHub Actions CI/CD
    (external)                 build → push → kustomize apply
```

### Key Design Decisions

**SQLite over Postgres** — Small fixed user base (4–6 people), write volume is extremely low. SQLite in WAL mode on a PVC is simpler and cheaper. Daily CronJob backup provides durability.

**AniList OAuth for auth** — Members log in via AniList. The callback upserts a `users` row and sets a session. Unknown AniList accounts are redirected to `/not-invited` — registration is closed by default.

**Groups model** — All data (seasons, members, assignments) is scoped to a `group_id`. The middleware chain is `requireAuth → requireGroupMember`, which reads `req.session.groupId` set at login. Cross-group data access is impossible at the query level.

**Weighted derangement** — Roll assignments use a two-tier weighted algorithm. Season-level pair history (strength 1.5) is corrected more aggressively than long-term historical drift (strength 0.3), so no single season feels repetitive but the randomness isn't fully eliminated.

**Roll lifecycle** — Rolls have four states: `drafting` (lock-in lobby) → `selecting` (blind picks from planning lists) → `active` (roll revealed, watching in progress) → `completed`. The dashboard and seasons page gate actions based on current roll state.

**Kustomize overlays** — `k8s/base/` holds canonical manifests; `overlays/dev` and `overlays/prod` patch replicas, image tags, and env vars. No Helm.

---

## Database Schema

Beyond the original tables, the following were added:

```sql
-- Auth and groups
users (id TEXT PK, anilist_id, anilist_token, username, avatar_url, created_at)
groups (id INTEGER PK, name, owner_id → users.id, created_at)
group_members (group_id → groups.id, user_id → users.id, joined_at)
group_invites (id, token UNIQUE, group_id, created_by, expires_at, used_at, used_by)

-- Roll lifecycle
rolls.state TEXT DEFAULT 'active'  -- drafting | selecting | active | completed
roll_readiness (roll_id, member_id, locked_at)
roll_selections (id, roll_id, assigner_id, assignee_id, anime_title, anilist_id, anilist_data, selected_at)

-- Foreign keys added to existing tables
members.group_id → groups.id
members.user_id → users.id
seasons.group_id → groups.id
seasons.roll_count INTEGER  -- max rolls per season
```

Key migration notes:
- Run `migrate.sql` on a fresh DB to add all new tables and columns
- Existing `members` rows need `group_id` and `user_id` backfilled manually
- Existing `seasons` rows need `group_id` backfilled
- Existing `rolls` rows default to `state = 'active'` — mark completed ones manually

---

## Roll Flow (New)

1. **Season page / Seasons page** — owner clicks "Create Roll Lobby" → `POST /api/seasons/:id/rolls` creates a roll in `drafting` state, navigates to `/roll/:id`
2. **Roll page (drafting)** — members click "Lock In"; owner sees readiness list polled every 3s. Owner can "Generate Assignments" (all locked in) or "Force Start — Pick Members" (custom member picker, overrides lock-in)
3. **Roll page (selecting)** — each assigner sees their assignee's AniList planning list. Others see "picking for X..." status. Picks are blind. On submit, server checks if all assigners have picked and auto-reveals if so
4. **Roll page (active)** — assignments revealed, normal watching/rating flow. AniList progress syncs on load
5. **Roll page (completed)** — same as active, read-only editing if all are done

---

## API Reference

### Assignments
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/assignments` | List (filter: `season_id`, `roll_id`, `member_id`, `assigner_id`) — scoped to group |
| `POST` | `/api/assignments` | Create; auto-fetches AniList metadata |
| `PATCH`| `/api/assignments/:id` | Update rating, episodes, status, notes |
| `DELETE`| `/api/assignments/:id` | Delete assignment — scoped to group |
| `POST` | `/api/assignments/:id/refresh-anilist` | Re-fetch AniList data |
| `POST` | `/api/assignments/bulk-refresh-anilist?season_id=` | Backfill AniList data; streams SSE progress |

### Seasons
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/seasons` | List all seasons for group (includes `rolls_completed` count) |
| `GET`  | `/api/seasons/active` | Active season + rolls + `currentRollState` |
| `POST` | `/api/seasons` | Create season; accepts `name`, `started_at`, `roll_count` |
| `PATCH`| `/api/seasons/:id` | Edit name, dates, active status, roll_count |
| `GET`  | `/api/seasons/:id/rolls` | List rolls for a season |
| `DELETE`| `/api/seasons/:id/rolls/:rollId` | Remove a roll and its assignments |
| `POST` | `/api/seasons/:id/rolls` | Create roll in `drafting` state (or `active` if `skip_derangement: true`) |

### Rolls
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/rolls/:id` | Roll metadata |
| `GET`  | `/api/rolls/:id/status` | Live state: readiness, selections, derangement — poll this |
| `POST` | `/api/rolls/:id/lock-in` | Lock in for this roll |
| `DELETE`| `/api/rolls/:id/lock-in` | Un-ready (drafting only) |
| `POST` | `/api/rolls/:id/generate` | Owner: run derangement, move to selecting. Body: `{ member_ids? }` for force start |
| `POST` | `/api/rolls/:id/select` | Submit anime pick; auto-reveals when all done |
| `PATCH`| `/api/rolls/:id/state` | Owner: manual state override |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/members` | Group members |
| `GET/PATCH` | `/api/members/:id` | Member detail / update |
| `GET`  | `/api/anime/search?q=` | AniList search proxy |
| `POST` | `/api/anime/anilist-proxy` | Raw AniList GraphQL proxy |
| `GET`  | `/api/stats/overview` | Global totals — scoped to group |
| `GET`  | `/api/stats/members` | Per-member stats, genre affinity, taste offset |
| `GET`  | `/api/stats/season/:id` | Season-level breakdown |
| `GET`  | `/api/stats/head-to-head` | Assigner→assignee rating matrix |
| `GET`  | `/auth/me` | Current session member + group info |
| `GET`  | `/auth/anilist` | Start AniList OAuth flow |
| `GET`  | `/auth/callback` | AniList OAuth callback |
| `POST` | `/auth/logout` | Destroy session |
| `GET`  | `/health` | Liveness probe |

---

## Auth Flow

1. User hits `/auth/anilist` → redirected to AniList OAuth
2. AniList redirects to `/auth/callback?code=` → server exchanges code for token, fetches AniList profile
3. If `anilist_username` matches an existing `members` row → session set (`memberId`, `memberName`, `groupId`), redirect to frontend
4. If no match → redirect to `/not-invited` (closed registration)
5. On login, `users` table is upserted with latest token and avatar

Session cookie is `httpOnly`, `secure` in production, `sameSite: none` in production / `lax` in development. All API fetches must include `credentials: "include"`.

---

## Middleware

Every API route is protected. Located at `backend/middleware/auth.js`:

- `requireAuth` — rejects 401 if no `req.session.memberId`
- `requireGroupMember` — verifies `req.session.groupId` membership via `group_members` join; sets `req.groupId` for downstream query scoping

Applied as `router.use(requireAuth, requireGroupMember)` at the top of each router. `anime.js` gets `requireAuth` only (it's a proxy, not group-scoped).

---

## Frontend Structure

```
src/
├── main.jsx                  ← wraps App in AuthProvider
├── App.jsx                   ← Nav (sidebar), ProtectedRoute, LoginPage, NotInvitedPage
├── lib/
│   └── AuthContext.jsx       ← useAuth() hook; fetches /auth/me once, provides member/logout/authBase
└── pages/
    ├── Dashboard.jsx         ← banner, global stats, current roll (or drafting/selecting prompt), members
    ├── Seasons.jsx           ← season list, new season form (with roll_count), new roll lobby creator
    ├── Season.jsx            ← collapsible roll panels, season avg/best/worst banner, member breakdown
    ├── Roll.jsx              ← state-driven: DraftingView | SelectingView | ActiveView
    ├── Member.jsx            ← member profile and assignment history
    ├── Stats.jsx             ← per-member stats, head-to-head matrix
    └── Admin.jsx             ← edit seasons, add historical rolls (new/existing roll), bulk AniList refresh, delete entries
```

### AuthContext

```js
const { member, logout, authBase } = useAuth();
// member: { id, name, avatar_url, group_id, group_name, owner_id, ... }
// logout: async fn that calls POST /auth/logout and nulls member
// authBase: VITE_API_URL with /api stripped
```

`member === undefined` means still loading. `member === null` means not logged in. `ProtectedRoute` in `App.jsx` handles redirecting null to `/login`.

### Roll page state machine

```
drafting   → DraftingView  (lock-in lobby, owner generates)
selecting  → SelectingView (assigners pick from planning list or search)
active     → ActiveView    (assignment cards, AniList sync, inline edit)
completed  → ActiveView    (same, read-only editing)
```

The page polls `GET /api/rolls/:id/status` every 3 seconds during `drafting` and `selecting`.

---

## Derangement Algorithm

Located at `backend/services/derangement.js`.

**`generateWeightedDerangement(members, seasonCounts, historyCounts)`**

Uses weighted random selection with two-tier bias correction:

```
weight = 1 / (1 + 1.5 * season_times + 0.3 * total_times)
```

- `season_times`: how many times this assigner→assignee pair occurred in the **current season**
- `total_times`: pair count across **all seasons**
- Season bias corrected aggressively (1.5), historical drift corrected gently (0.3)
- Falls back to pure random `generateDerangement()` if no history or if weighted approach fails

The generate route (`POST /api/rolls/:id/generate`) queries `assignments` for completed rolls in the group, builds both count maps, and calls `generateWeightedDerangement`. Accepts optional `member_ids` body param for force start with a custom participant list.

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
cp .env.example .env   # fill in ANILIST_CLIENT_ID, ANILIST_CLIENT_SECRET, ANILIST_REDIRECT_URI, SESSION_SECRET, FRONTEND_URL
node seed.js           # import historical Excel data (optional)
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

**Important:** AniList only allows one redirect URI per app. Create a separate AniList app for local dev pointing to `localhost:3001/auth/callback`, and a separate one for production pointing to your Railway/production URL.

### Database Setup (first time)

```bash
sqlite3 ./data/anime-club.db < migrate.sql
```

Then seed your group directly in SQLite (see `migrate.sql` for the pattern — insert users, create group, fill group_members, backfill group_id on members and seasons).

### Production Deploy (Railway)

Push to `main` — GitHub Actions handles the rest. Required Railway env vars: same as above but with production values. `NODE_ENV=production` enables secure cookies and `sameSite: none`.

---

## Project Structure

```
anime-club/
├── .github/workflows/deploy.yml      ← CI/CD
├── backend/
│   ├── server.js                     ← Express entry; mounts all routers
│   ├── db.js                         ← SQLite connection (WAL mode)
│   ├── migrate.sql                   ← schema migration: groups, users, roll lifecycle tables
│   ├── middleware/
│   │   └── auth.js                   ← requireAuth, requireGroupMember
│   ├── routes/
│   │   ├── anime.js                  ← AniList search + proxy
│   │   ├── assignments.js            ← CRUD + AniList refresh, group-scoped
│   │   ├── members.js                ← group-scoped members
│   │   ├── rolls.js                  ← roll lifecycle: lock-in, generate, select, status
│   │   ├── seasons.js                ← seasons + roll creation, group-scoped
│   │   ├── stats.js                  ← all stats, group-scoped
│   │   └── auth.js                   ← AniList OAuth, session management
│   └── services/
│       ├── anilist.js                ← GraphQL client
│       └── derangement.js            ← weighted + pure random derangement
├── frontend/
│   ├── src/
│   │   ├── main.jsx                  ← entry, wraps in AuthProvider
│   │   ├── App.jsx                   ← routing, Nav, ProtectedRoute
│   │   ├── lib/AuthContext.jsx        ← auth state, useAuth hook
│   │   └── pages/                    ← Dashboard, Seasons, Season, Roll, Member, Stats, Admin
│   └── ...
└── k8s/
    ├── base/                         ← canonical manifests
    └── overlays/dev + prod           ← kustomize patches
```

---

## Known Quirks and Context

- **Members table uses text IDs** (e.g. `"jsn"`, `"olx"`) not integers — these are the original short names used as PKs since before the auth system was added
- **Avatar URLs** are stored on both `members` and `users` tables — `members.avatar_url` is what the frontend uses, updated on each login via the OAuth callback
- **AniList sync** in `ActiveView` runs on mount and overwrites local `episodes_watched`/`status` — disable it temporarily when testing locally by commenting out the sync block
- **`roll_count` null** means unlimited rolls for that season (legacy seasons have null)
- **Production group is `group_id = 1`**, local dev group may differ depending on migration order — if 403s appear after local setup, check that `members.group_id` matches `groups.id` and matches `req.session.groupId`
- **CSP and avatar images** — helmet blocks external images by default; `s4.anilist.co` is whitelisted in the helmet config in `server.js`

---

## TODO

### Invite system (stubbed, not implemented)
The `group_invites` table is already in the schema (`token`, `group_id`, `created_by`, `expires_at`, `used_at`, `used_by`). What's needed:
- `POST /api/groups/invite` — owner generates a UUID token, inserts row with 48hr expiry
- `GET /join?token=` — frontend page that shows group name and a "Join" button
- `POST /api/groups/join` — validates token (not expired, not used), creates `group_members` row and a `members` row, marks token as used
- The "not invited" page should eventually link to a join flow or show a contact message

### New user / no group flow
Currently if someone logs in and has no matching `members` row they hit `/not-invited`. The full flow would be:
- "No group" state: show "Create a group or join one with an invite link"
- Create group: user becomes owner and first member
- Join group: via invite token flow above

### Migration tooling
Schema changes are currently applied manually via `sqlite3 < migrate.sql`. A proper migration runner (e.g. `better-sqlite3-migrations`) would track which migrations have run in a `_migrations` table, making deploys safer. The numbered SQL files are already in place conceptually.

### Roll page — reveal animation
When `selecting → active`, the page currently just re-fetches and re-renders. A reveal animation (cards flipping in one by one) would be a nice touch.

### Stats page — pair history visualization
The weighted derangement tracks assigner→assignee pair counts but there's no UI to see the distribution. A heatmap on the stats page showing how evenly distributed pairs are across seasons would be useful, especially for debugging perceived bias.

### Admin — roll state override UI
`PATCH /api/rolls/:id/state` exists but there's no UI for it in the Admin page. Useful for recovering from stuck rolls without SSH.

### Production backup automation
Currently backups are manual (`railway ssh -- base64 /app/data/anime-club.db > backup.b64`). The CronJob in `k8s/base/cron-backup.yaml` is the intended solution — needs S3 credentials configured in Railway and the job manifests applied.