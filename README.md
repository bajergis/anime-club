# 番 Bois Anime Club

A full-stack web application for tracking our friend group's weekly anime assignment rotation — built as a portfolio project demonstrating Kubernetes-native application design.

**Live:** `https://anime.yourapp.dev` &nbsp;|&nbsp; **Stack:** Node.js · React · SQLite · Kubernetes · GitHub Actions

---

## What It Does

Each week ("roll"), a derangement algorithm assigns every member to pick an anime for exactly one other person — nobody picks for themselves. Members track their progress, rate each show, and the app surfaces stats like:

- Per-member average ratings and taste profiles vs AniList community scores
- Head-to-head matrix: how does each person rate shows picked by each other person
- Genre affinity breakdown across seasons
- Completion/drop rates per member

Historical data spans **4 seasons (2020–present)**, imported from the original Excel tracker.

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

**SQLite over Postgres** — This app has a small fixed user base (4–6 people) and write volume is extremely low (a few updates per week). SQLite in WAL mode on a PVC is simpler, cheaper, and eliminates a stateful database operator. The daily CronJob backup provides durability without Postgres complexity.

**Kustomize overlays** — `k8s/base/` holds the canonical manifests; `overlays/dev` and `overlays/prod` patch replica counts, image tags, and environment variables. No Helm, no templating language to learn.

**HPA on the API** — Even though load is light, having an HPA configured demonstrates autoscaling intent and is trivially correct for a public-facing service.

**Derangement as a service** — The original Python script is ported to `backend/services/derangement.js` and exposed via `POST /api/seasons/:id/rolls`. Each new roll stores the full derangement JSON for auditability.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/assignments` | List assignments (filter by `season_id`, `roll_id`, `member_id`) |
| `POST` | `/api/assignments` | Create assignment; auto-fetches AniList metadata |
| `PATCH`| `/api/assignments/:id` | Update rating, episodes, status |
| `POST` | `/api/assignments/:id/refresh-anilist` | Re-fetch AniList data for one assignment |
| `POST` | `/api/assignments/bulk-refresh-anilist?season_id=` | Backfill AniList data for all missing rows; streams SSE progress |
| `GET`  | `/api/seasons` | List all seasons |
| `GET`  | `/api/seasons/active` | Active season + its rolls |
| `POST` | `/api/seasons` | Create season (deactivates current) |
| `PATCH`| `/api/seasons/:id` | Edit name, started\_at, ended\_at, is\_active |
| `POST` | `/api/seasons/:id/rolls` | Generate roll + derangement (pass `skip_derangement: true` for manual entry) |
| `DELETE`| `/api/seasons/:id/rolls/:rollId` | Remove a roll and all its assignments |
| `GET`  | `/api/anime/search?q=` | Search AniList for anime metadata |
| `GET`  | `/api/stats/overview` | Global totals |
| `GET`  | `/api/stats/members` | Per-member stats, genre affinity, taste offset |
| `GET`  | `/api/stats/season/:id` | Season-level breakdown |
| `GET`  | `/api/stats/head-to-head` | Assigner→assignee rating matrix |
| `GET`  | `/health` | Liveness probe |

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
node seed.js          # import historical Excel data
npm run dev           # starts on :3001

# Frontend (separate terminal)
cd ../frontend
npm install
npm run dev           # starts on :5173, proxies /api → :3001
```

### Kubernetes (local with kind) #todo

```bash
# Create cluster
kind create cluster --name anime-club

# Apply dev overlay
kubectl apply -k k8s/overlays/dev

# Forward ports
kubectl port-forward svc/anime-club-frontend 8080:80 -n anime-club-dev &
kubectl port-forward svc/anime-club-api 3001:3001 -n anime-club-dev &
```

### Production Deploy

Push to `main` — GitHub Actions handles the rest:
1. Lint + build check
2. Build & push images to GHCR (tagged with commit SHA)
3. Update image tags in `k8s/overlays/prod/kustomization.yaml`
4. `kubectl apply -k k8s/overlays/prod`
5. Wait for rollout

Required secrets: `KUBECONFIG` (base64), `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

---

## Project Structure

```
anime-club/                            ← repo root
│
├── .github/
│   └── workflows/
│       └── deploy.yml                 ← CI/CD: lint → build images → push to GHCR → kubectl apply
│
├── backend/                           ← Node.js API (runs on port 3001)
│   ├── Dockerfile                     ← multi-stage build; final image runs node server.js
│   ├── package.json                   ← dependencies: express, better-sqlite3, helmet, etc.
│   ├── server.js                      ← Express entry point, mounts all routers
│   ├── db.js                          ← SQLite connection (WAL mode) + CREATE TABLE schema
│   ├── seed.js                        ← one-time import: Bois_Anime.xlsx → SQLite
│   ├── routes/
│   │   ├── anime.js                   ← GET /api/anime/search?q= (proxies AniList)
│   │   ├── assignments.js             ← CRUD for assignments + AniList refresh
│   │   ├── members.js                 ← GET/POST/PATCH /api/members
│   │   ├── seasons.js                 ← seasons + roll generation + derangement
│   │   └── stats.js                   ← overview, per-member, season, head-to-head
│   └── services/
│       ├── anilist.js                 ← GraphQL client for AniList API (no key needed)
│       └── derangement.js             ← shuffle algorithm: no one picks for themselves
│
├── frontend/                          ← React app (Vite, runs on port 5173 in dev)
│   ├── Dockerfile                     ← builds with Vite, serves via nginx
│   ├── index.html                     ← HTML entry point (Vite convention; lives at root of frontend/)
│   ├── nginx.conf                     ← SPA fallback: all 404s → index.html
│   ├── package.json                   ← dependencies: react, react-dom, react-router-dom
│   ├── vite.config.js                 ← dev proxy: /api → localhost:3001
│   └── src/
│       ├── main.jsx                   ← ReactDOM.createRoot entry
│       ├── App.jsx                    ← BrowserRouter, sidebar nav, route definitions
│       ├── App.css                    ← full design system: CSS vars, cards, badges, tables
│       └── pages/
│           ├── Dashboard.jsx          ← active season banner, current roll cards, member list
│           ├── Seasons.jsx            ← all seasons list, new season form, roll generator UI
│           ├── Season.jsx             ← season detail: roll table, member breakdown, end-date edit
│           ├── Roll.jsx               ← roll detail: assignment cards with inline edit + AniList link
│           ├── Member.jsx             ← member profile: full assignment history with covers
│           ├── Stats.jsx              ← per-member stats + head-to-head rating matrix
│           └── Admin.jsx              ← edit seasons, add historical rolls, bulk AniList refresh
│
└── k8s/
    ├── base/                          ← canonical manifests, applied by both overlays
    │   ├── kustomization.yaml         ← lists all base resources (used by kustomize)
    │   ├── api-deployment.yaml        ← Deployment for backend (2 replicas, liveness probe, PVC mount)
    │   ├── frontend-deployment.yaml   ← Deployment for frontend (2 replicas)
    │   ├── services-and-infra.yaml    ← ClusterIP Services + PVC + ConfigMap + nginx Ingress
    │   ├── hpa.yaml                   ← HorizontalPodAutoscaler: API scales 2→6 on CPU/memory
    │   └── cron-backup.yaml           ← CronJob: copies SQLite DB to S3 daily at 3 AM UTC
    └── overlays/
        ├── dev/
        │   └── kustomization.yaml     ← patches replicas to 1, points URLs at localhost
        └── prod/
            └── kustomization.yaml     ← patches replicas to 3, pins exact image SHA tags
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| API | Express (Node 20, ESM) | Familiar, lightweight, easy to containerize |
| DB | SQLite + better-sqlite3 | Zero-infra, WAL mode handles concurrent reads fine for this scale |
| Frontend | React + React Router | Component model fits the multi-page data views |
| Styling | Vanilla CSS + CSS variables | No build-time dependency, fast HMR, easy theming |
| Container orchestration | Kubernetes + Kustomize | The whole point — demonstrates real k8s patterns |
| CI/CD | GitHub Actions | Native GHCR integration, free for public repos |
| External API | AniList GraphQL | Free, no API key required, rich metadata |