# Contributing

This is a pnpm monorepo with three packages:

- `packages/shared` — types and constants shared between client and server.
- `packages/server` — Express + Socket.IO API, Prisma + SQLite, music scanner, Spotify integration.
- `packages/web` — React + Vite + TailwindCSS UI (patron, admin, and now-playing display).
- `packages/spotify-relay` — a single static HTML page used as the Spotify OAuth redirect target.

## Dev loop

```bash
pnpm install
pnpm dev       # server on :3001, Vite on :1738 with HMR + API proxy
```

Vite proxies `/api` and `/socket.io` to the server, so the Vite URL is the one you open during development.

## Production loop

`pnpm setup` is what end users run. As a developer you can also:

```bash
pnpm build     # builds shared, server, web
pnpm start     # node packages/server/dist/index.js — serves API + web on the same port
```

In production mode the server statically serves `packages/web/dist`, so there's only one port to think about.

## Database

SQLite via Prisma. Schema in [`packages/server/prisma/schema.prisma`](packages/server/prisma/schema.prisma).

```bash
pnpm -F @playplay/server db:migrate     # create a new migration during dev
pnpm -F @playplay/server db:studio      # browse the DB
pnpm -F @playplay/server db:reset       # nuke and re-apply migrations
```

The seed script is intentionally a no-op — first-run configuration is handled by the wizard ([`scripts/setup.mjs`](scripts/setup.mjs)) which calls [`packages/server/src/scripts/firstRun.ts`](packages/server/src/scripts/firstRun.ts).

## Secrets

Per-venue secrets (currently just Spotify credentials) are encrypted with AES-256-GCM using a key derived from `JWT_SECRET` via HKDF. See [`packages/server/src/lib/secrets.ts`](packages/server/src/lib/secrets.ts). Rotating `JWT_SECRET` invalidates stored secrets — the user has to re-enter Spotify credentials in the Admin UI.
