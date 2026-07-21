# QuizUp

**QuizUp** is a real-time 1v1 trivia battle app. Players pick a topic, get matched (or challenge a friend), and compete live across timed multiple-choice questions. Climb leagues with XP, follow people, chat, and share community posts.

Live site: [https://quizup.site](https://quizup.site)

---

## What you can do

### Play
- **Browse topics** — hundreds of categories (text + image questions)
- **Quick match** — queue for a random opponent in a category
- **Friend challenges** — invite someone with a shareable link; accept/decline in real time
- **Live battles** — timed rounds, server-authoritative scoring (100 base + up to 100 speed bonus per correct answer), reconnect grace period if you drop offline mid-match
- **Match history** — review past results

### Progress
- **Levels & XP** — earn XP from matches; thresholds grow with level
- **Leagues** — Unranked → Bronze → Silver → Gold → Crystal → Master → Champion → Titan → Legend
- **Achievements** — unlock badges for play milestones
- **Leaderboards** — global and category rankings

### Social
- **Profiles** — avatar, banner, bio, followed topics, stats
- **People & friends** — discover users, follow, challenge
- **Direct chat** — 1:1 messaging with unread badges (optional Giphy GIFs)
- **Community feed** — posts with text, images, and video
- **Share links** — challenge and category pages with Open Graph previews for social crawlers

### Account & admin
- Email/password signup and login, plus **Google Sign-In**
- Onboarding: profile setup and topic preferences
- Settings and notifications
- **Admin panel** — manage categories/questions, bulk create, AI question generation (Gemini pipeline)

### Platforms
- **Web** — React SPA (HashRouter)
- **Android** — Capacitor wrapper (`com.quizup.app`) with splash screen, status bar, hardware back-button handling, and socket reconnect on resume/network recovery

---

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Framer Motion, TanStack Query, React Router, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO, MongoDB (Mongoose), Redis (BullMQ), JWT auth |
| Media | AWS S3 (uploads + legacy `/uploads` redirects) |
| AI content | Google Gemini question pipeline (queued via Redis/BullMQ) |
| Mobile | Capacitor 8 (Android) |
| Process mgr | PM2 (`ecosystem.config.cjs`) |
| Tests | Vitest, React Testing Library |

---

## Project structure

```
quiz-blitz-arena/
├── src/                    # React frontend
│   ├── pages/              # Routes (lobby, battle, social, admin, …)
│   ├── components/         # UI, layout, SEO, community
│   ├── battle/             # Client battle state (reducer, socket mapping)
│   ├── services/           # REST + socket clients
│   ├── hooks/              # Auth, chat unread, Capacitor lifecycle
│   ├── lib/                # Progression, media URLs, share helpers
│   └── config/             # API/socket URLs, SEO
├── backend/
│   ├── src/
│   │   ├── routes/         # REST API
│   │   ├── controllers/
│   │   ├── models/         # User, Match, Question, Category, Chat, Community, …
│   │   ├── sockets/        # Matchmaking, battle, chat, challenges
│   │   ├── services/       # Battle engine, matchmaking, Gemini, achievements
│   │   ├── queue/          # Redis + BullMQ question pipeline
│   │   └── workers/        # Pipeline worker
│   └── docker-compose.yml  # Local MongoDB + Redis
├── android/                # Capacitor Android project
├── deploy/                 # Nginx / Certbot helpers
├── public/                 # Static assets, branding, leagues, audio
└── BUILD.md                # Android build & release notes
```

---

## Architecture (high level)

1. **REST (`/api/*`)** — auth, profiles, categories, matches, challenges, chat, community, leaderboard, admin, media proxy.
2. **WebSockets (Socket.IO)** — JWT in the handshake; rooms for matchmaking, live battles, DMs, and challenge invites. Online presence is tracked server-side.
3. **Battle authority** — the server scores answers, advances questions, and never sends the correct index to clients until the round ends.
4. **Question pipeline** — admins can enqueue AI generation; a Redis worker verifies/enriches questions (optional image search via Serp/Pexels/etc.) and stores them in MongoDB / S3.
5. **Production serving** — Vite build lands in `dist/`; the Express server can serve the SPA and API together (see `start:server` / PM2).

---

## Getting started

### Prerequisites

- Node.js 18+
- npm
- Docker (optional, for local MongoDB + Redis)

### 1. Infrastructure

From `backend/`:

```bash
docker compose up -d
```

This starts MongoDB on `27017` and Redis on `6379`.

### 2. Backend

```bash
cd backend
npm install
# Create backend/.env (see Environment variables below)
npm run seed          # optional sample data
npm run dev           # nodemon on PORT (default 3003)
```

Optional AI worker (same machine or separate process):

```bash
# in backend/.env: RUN_EMBEDDED_PIPELINE_WORKER=true
# or: npm run start:worker
```

### 3. Frontend

From the repo root (`quiz-blitz-arena/`):

```bash
npm install
# Create .env with VITE_API_URL=http://localhost:3003 (and optional keys)
npm run dev
```

Open the Vite URL (typically `http://localhost:8080` or `5173`).

### 4. Production-style local run

```bash
npm run start:server   # builds frontend, then starts backend
```

---

## Environment variables

### Frontend (`.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend HTTP origin (e.g. `http://localhost:3003`) |
| `VITE_SOCKET_URL` | Socket origin if different from API |
| `VITE_APP_URL` | Public app URL for share/canonical links |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_GIPHY_API_KEY` | Optional GIF search in chat |

### Backend (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `3003`) |
| `MONGODB_URI` | Mongo connection string |
| `REDIS_URL` | Redis for queues / matchmaking helpers |
| `JWT_SECRET` | Required for auth tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `30d`) |
| `CLIENT_URL` / `FRONTEND_URL` / `ALLOWED_ORIGINS` | CORS + Socket.IO origins |
| `GOOGLE_CLIENT_ID` | Server-side Google token verification |
| `AWS_REGION`, `S3_BUCKET_NAME`, `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Media storage |
| `GEMINI_API_KEY` | AI question generation |
| `RUN_EMBEDDED_PIPELINE_WORKER` | `true` to run the worker inside the API process |

Image-search helpers used by the pipeline may also need keys such as `SERP_API_KEY`, `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, or `SEARCHSTACK_KEY`.

---

## Scripts

### Root (`package.json`)

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production frontend build → `dist/` |
| `npm run start:server` | Build + start backend |
| `npm run pm2:deploy` | Build + PM2 start/reload |
| `npm run pm2:restart` | Restart PM2 app `quizup` |
| `npm run test` | Vitest once |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |

### Backend (`backend/package.json`)

| Command | Description |
| --- | --- |
| `npm run dev` | Nodemon API server |
| `npm start` | Production API server |
| `npm run start:worker` | Question pipeline worker |
| `npm run seed` | Seed database |
| `npm run verify:s3` / `migrate:*` | S3 media migration utilities |

---

## Main app routes

| Path | Screen |
| --- | --- |
| `/landing`, `/login`, `/signup` | Public auth |
| `/` | Home lobby (topics, challenges, presence) |
| `/categories`, `/all-categories`, `/category/:id` | Topic browse & detail |
| `/find-match/:categoryId` | Matchmaking |
| `/battle` | Live match |
| `/challenge/:challengeId` | Challenge invite |
| `/leaderboard`, `/history` | Rankings & past matches |
| `/people`, `/friends`, `/social` | Discovery & community |
| `/profile`, `/profile/:userId` | Profiles |
| `/chat/:peerId` | Direct messages |
| `/achievements`, `/settings`, `/notifications` | Progress & account |
| `/onboarding/profile`, `/onboarding/topics` | First-run setup |
| `/admin` | Admin (role-gated) |

Share preview HTML (for crawlers, not the SPA): `/share/challenge/:id`, `/share/category/:id`.

---

## Android

See **[BUILD.md](./BUILD.md)** for JDK/SDK prerequisites, `cap sync`, Gradle APK/AAB builds, signing, and native behavior (back button, splash, reconnect).

Short path:

```bash
npm run build
npx cap sync android
npx cap open android   # or: cd android && ./gradlew assembleDebug
```

---

## Deployment notes

- Production app name in PM2: `quizup` (`ecosystem.config.cjs`).
- Nginx + TLS helpers live under `deploy/`.
- CORS allows `quizup.site`, Capacitor origins (`https://localhost`, etc.), and configured `ALLOWED_ORIGINS`.
- Health check: `GET /health` (includes Mongo ready state).

---

## License

Private / unpublished unless otherwise noted.
