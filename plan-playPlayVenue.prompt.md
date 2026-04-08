# Plan: PlayPlay Venue — Collaborative Jukebox MVP

A web-based collaborative jukebox where venue patrons scan a QR code, suggest songs, and vote on the queue. MVP uses a local MP3 library with server-side streaming; Spotify and other services come post-MVP.

**Tech Stack**: React + Vite + TypeScript + TailwindCSS | Node.js + Express | PostgreSQL + Prisma | Socket.IO | pnpm monorepo

**Architecture**: Single React app with three route-based views — Patron (`/venue/:slug`), Now Playing display (`/venue/:slug/now-playing`), Admin (`/admin`). Server exposes REST API + Socket.IO for realtime. Audio streamed via HTTP range requests.

---

## Phase 1: Project Scaffolding

**Goal**: Monorepo running, database schema created, dev environment working.

1. Initialize pnpm workspace with `packages/server`, `packages/web`, `packages/shared`
2. Configure TypeScript project references across packages
3. Scaffold `packages/web` with Vite + React + TailwindCSS + React Router
4. Scaffold `packages/server` with Express + ts-node-dev
5. Scaffold `packages/shared` with shared types and constants
6. Define full Prisma schema — **Venue**, **User** (PATRON/ADMIN roles), **Song**, **QueueEntry** (QUEUED/PLAYING/PLAYED/REMOVED statuses), **Vote** (unique per user+entry, value +1/-1)
7. Run initial migration + seed script (sample venue + songs)

**Verify**: `pnpm dev` starts both apps; Prisma Studio shows tables; shared types import in both packages.

---

## Phase 2: Auth + Sessions

**Goal**: Phone OTP login for patrons, admin auth, JWT sessions.

1. `POST /api/auth/request-otp` — generates 6-digit code, logs to console, stores with TTL
2. `POST /api/auth/verify-otp` — validates code, creates/finds User, returns JWT
3. Auth middleware (JWT from Bearer header)
4. Admin login flow (email + phone, role check)
5. `POST /api/auth/set-display-name` — authenticated user sets name
6. Env vars: `DATABASE_URL`, `JWT_SECRET`, `OTP_TTL_SECONDS`

**Verify**: OTP flow works end-to-end; protected endpoints reject unauthenticated requests.

---

## Phase 3: Music Library + Search

**Goal**: Ingest MP3s, search by title/artist, stream audio.

1. Use `music-metadata` to scan a configured directory and extract ID3 tags
2. `POST /api/admin/music/scan` — triggers re-scan, upserts Song records
3. `GET /api/songs/search?q=` — text search on title + artist
4. `GET /api/songs/:id/stream` — MP3 streaming with HTTP range requests (seeking support)
5. `GET /api/songs` — paginated song list

**Verify**: Drop MP3s in directory → scan → songs in DB → search works → audio plays in browser with seeking.

---

## Phase 4: Queue Engine

**Goal**: Core queue logic — add, vote, order, auto-remove, limits.

1. `POST /api/queue/add` — enforces max songs/user, no duplicates, not blocked
2. `POST /api/queue/:entryId/vote` — one vote per user per entry (upsert), recalculates score
3. `GET /api/queue` — sorted by voteScore DESC, createdAt ASC; includes user's vote state
4. `DELETE /api/queue/:entryId` — admin only
5. `POST /api/queue/:entryId/play-now` — admin only, moves to front
6. `POST /api/queue/reorder` — admin only
7. Negative vote threshold auto-removal (configurable, default -5)
8. `GET /api/queue/history` + `GET /api/queue/now-playing`

**Verify**: Full vote lifecycle; reordering; threshold removal; duplicate/limit enforcement.

---

## Phase 5: Realtime + Playback

**Goal**: Live updates via WebSockets, audio playback, auto-advance.

1. Socket.IO server with venue-based rooms (join by slug)
2. Events: `queue:updated`, `now-playing:changed`, `queue:entry-removed`, `queue:entry-added`
3. Every queue mutation broadcasts updated state to the venue room
4. Playback state machine: IDLE → PLAYING → track ends → next or default playlist
5. Client reports `playback:ended` → server advances queue, broadcasts change
6. Empty queue → shuffle from default playlist directory (flagged `isDefault: true`)

**Verify**: Two tabs show realtime sync; song auto-advances; empty queue falls back to defaults; reconnect recovery.

---

## Phase 6: Patron (User) View

**Goal**: Mobile-first patron experience — join, search, vote.

1. `/venue/:slug` entry point; unauthenticated users → OTP login → display name → queue
2. Queue page: Now Playing card + upcoming list with up/down vote buttons + "Add Song" button
3. Search page: debounced search, "Add to Queue" or "Already In Queue" states
4. History section (collapsible/tab)
5. Socket.IO hook for real-time queue state
6. Mobile-first responsive design

**Verify**: Full patron flow from QR scan to voting; mobile layout; real-time updates; vote state reflected correctly.

---

## Phase 7: Now Playing Display View

**Goal**: Passive, view-only screen for venue TVs.

1. `/venue/:slug/now-playing` — no auth, landscape-optimized
2. Large Now Playing section (title, artist, vote count) + queue sidebar + history
3. QR code (via `qrcode.react`) pointing to patron URL
4. Venue name/branding + ad/promo placeholder
5. Auto-updates via Socket.IO, no interaction needed
6. Fullscreen toggle + Wake Lock API (prevent screen sleep)

**Verify**: Auto-updates on song/vote changes; QR code scans correctly; works on 1080p landscape; fully passive.

---

## Phase 8: Admin Dashboard

**Goal**: Venue setup, queue/user/song management, settings.

1. `/admin` — admin auth required
2. **First-Run Experience**: venue name/slug, music path, initial scan, preferences
3. **Dashboard**: current state overview (now playing, queue, active users)
4. **Queue management**: drag-to-reorder, remove, play now, vote breakdown
5. **Music library**: browse songs, block/unblock, re-scan
6. **User management**: list, block/unblock, view activity
7. **Settings**: vote threshold, max songs/user, default playlist path, light/dark theme toggle

**Verify**: FRE creates functional venue; queue admin actions reflect in patron/display views; blocking works; settings apply immediately.

---

## Key Decisions

- **Browser-only** — no native apps; PWA is post-MVP
- **Single React app** with route-based views (not 3 separate apps)
- **One venue per deployment** for MVP — multi-venue SaaS is post-MVP
- **Simulated OTP** — console-logged codes, swap in Twilio later
- **Server streams audio** — venue's Now Playing browser tab plays music via `<audio>` element
- **Phone-only for patrons, email+phone for admins**

## Out of Scope (Post-MVP)

- Spotify / Apple Music / streaming service integration
- Real SMS OTP
- Multi-venue SaaS mode
- PWA, audio visualizer, tip/priority queue, analytics dashboard

---

Each phase is independently deployable and verifiable. Phases 1–5 are backend-heavy and sequential. Phases 6, 7, and 8 (the three UI views) can be built **in parallel** once Phase 5 is complete.

## Planned File Structure

```
playplay-venue/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/          — User, Song, QueueEntry, Vote, Venue, API types
│   │   │   ├── constants.ts    — defaults, limits, event names
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── server/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── index.ts           — Express + Socket.IO setup
│   │   │   ├── routes/            — auth, queue, songs, admin
│   │   │   ├── middleware/        — auth JWT, admin guard, error handler
│   │   │   ├── services/         — queue engine, music scanner, playback state, auth/otp
│   │   │   ├── socket/           — Socket.IO event handlers, room management
│   │   │   └── utils/            — helpers
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx            — React Router setup
│       │   ├── pages/
│       │   │   ├── patron/        — Queue, Search, Login
│       │   │   ├── display/       — NowPlaying display view
│       │   │   └── admin/         — Dashboard, Queue mgmt, Users, Settings, FRE
│       │   ├── components/        — shared UI components
│       │   ├── hooks/             — useSocket, useQueue, useAuth
│       │   ├── contexts/          — AuthContext, SocketContext, QueueContext
│       │   └── api/               — API client functions
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       └── tsconfig.json
```
