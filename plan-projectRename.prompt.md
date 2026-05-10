# Plan: Project rename (PlayPlay Venue → `<NEW_NAME>`)

Pre-release rename, so no migration concerns — we can hard-rename localStorage keys, the HKDF salt, and the sentinel file without breaking anyone. Local folder stays put; relay URL stays put; everything else gets the new name.

## Naming variants to plug in once a name is chosen

- `<NEW_NAME>` — display brand (Title Case), e.g. `Qbox`
- `<new-name>` — kebab-case for repo / sentinel / localStorage / salt, e.g. `qbox`
- `<newname>` — lowercase no-separator for npm scope, e.g. `qbox`
- `<NEWNAME>` — uppercase for env var prefix, e.g. `QBOX`
- Decision: drop the "Venue" suffix everywhere

## Phases

### Phase 1 — Package identity (pnpm + workspace)

1. Rename `name` in workspace [package.json](package.json) → `<new-name>`
2. Rename scoped packages:
   - [packages/server/package.json](packages/server/package.json) → `@<newname>/server`
   - [packages/web/package.json](packages/web/package.json) → `@<newname>/web`
   - [packages/shared/package.json](packages/shared/package.json) → `@<newname>/shared`
3. Update `workspace:*` deps that reference `@playplay/shared` in [packages/server/package.json](packages/server/package.json) and [packages/web/package.json](packages/web/package.json)
4. Update root `dev` / `build` / `start` scripts in [package.json](package.json) that pass `--filter @playplay/...`
5. `pnpm install` to regenerate [pnpm-lock.yaml](pnpm-lock.yaml)

### Phase 2 — Code identifiers (parallel with Phase 1)

6. [packages/server/src/lib/secrets.ts](packages/server/src/lib/secrets.ts) — `APP_SALT` from `"playplay-venue:secrets:v1"` → `"<new-name>:secrets:v1"`
7. [packages/web/src/api/client.ts](packages/web/src/api/client.ts) — `TOKEN_KEY`, `DEVICE_ID_KEY` from `playplay_*` → `<new-name>_*`
8. [packages/web/src/contexts/ThemeContext.tsx](packages/web/src/contexts/ThemeContext.tsx) — `STORAGE_KEY` (`playplay-theme`), `FONT_LINK_ID` (`playplay-theme-font`)
9. [packages/server/src/scripts/firstRun.ts](packages/server/src/scripts/firstRun.ts) — `PLAYPLAY_ANSWERS` env var → `<NEWNAME>_ANSWERS`. Also update consumer in [scripts/setup.mjs](scripts/setup.mjs)
10. [scripts/setup.mjs](scripts/setup.mjs) — temp answers filename `playplay-answers-*.json`

### Phase 3 — User-visible strings

11. HTML titles:
    - [packages/web/index.html](packages/web/index.html) `<title>`
    - [packages/spotify-relay/index.html](packages/spotify-relay/index.html) `<title>`
12. [packages/server/src/index.ts](packages/server/src/index.ts) — startup banner `"PlayPlay Venue is running:"`
13. [scripts/setup.mjs](scripts/setup.mjs) — wizard intro `p.intro("PlayPlay Venue — First-Run Setup")`, Node-version error message, file header comment
14. [packages/web/src/hooks/useSpotifyPlayer.ts](packages/web/src/hooks/useSpotifyPlayer.ts) — Spotify Web Playback `name: "PlayPlay Venue"` (this is what shows up in Spotify's "Devices" list)
15. Launcher script comments:
    - [scripts/launchers/start.bat](scripts/launchers/start.bat), [scripts/launchers/start.command](scripts/launchers/start.command), [scripts/launchers/start.sh](scripts/launchers/start.sh)
    - [scripts/launchers/setup.bat](scripts/launchers/setup.bat), [scripts/launchers/setup.command](scripts/launchers/setup.command), [scripts/launchers/setup.sh](scripts/launchers/setup.sh)

### Phase 4 — Sentinel file + env example

16. [packages/server/.playplay-configured](packages/server/.playplay-configured) — rename to `.<new-name>-configured`. Update writer/reader in [scripts/setup.mjs](scripts/setup.mjs)
17. Add `packages/server/.<new-name>-configured` to [.gitignore](.gitignore) if `.playplay-configured` is currently listed

### Phase 5 — Documentation

18. [README.md](README.md) — full rebrand: title, tagline, badges, every "PlayPlay Venue" / "PlayPlay" reference, including the example Spotify app name `"PlayPlay – My Venue"`
19. [CONTRIBUTING.md](CONTRIBUTING.md) — `@playplay/*` filter examples
20. [LICENSE](LICENSE) — copyright line `<NEW_NAME> contributors`
21. Old planning docs: delete or rename [plan-playPlayVenue.prompt.md](plan-playPlayVenue.prompt.md) and [plan-addUrlBasedTabRouting.prompt.md](plan-addUrlBasedTabRouting.prompt.md) if they leak the old name

### Phase 6 — GitHub repo (manual, post-merge)

22. github.com → repo Settings → rename `playplay-venue` → `<new-name>`. GitHub auto-redirects the old URL.
23. `git remote set-url origin git@github.com:<owner>/<new-name>.git` locally
24. Search [README.md](README.md) for any hardcoded `github.com/.../playplay-venue` URLs (badges, clone instructions) and update

## Things explicitly NOT changing

- Local working folder stays `c:\Users\rodriguezala\src\playplay-venue`
- Spotify relay URL stays `https://spotify-relay.vercel.app` (generic enough; changing it forces every Spotify app config to update its Redirect URI)
- SQLite / Prisma file stays `dev.db`

## Execution strategy

- Phases 1–5 can be done in a single PR. Phase 6 is post-merge.
- Phases 1, 2, 3, 4 are independent file edits — can be done in parallel via multi-file edits.
- After all edits: delete `node_modules`, `pnpm install`, `pnpm -r build`, then run `pnpm setup --reconfigure` to regenerate the sentinel and verify wizard banner.

## Verification checklist

1. `pnpm install` succeeds (lockfile picks up new scope)
2. `pnpm -r build` succeeds (no stale `@playplay/shared` import errors)
3. `pnpm setup --reconfigure` runs, wizard intro shows new name
4. Server startup banner shows new name
5. Open `/admin` → Spotify Devices in Spotify shows new name when patron connects
6. Browser tab title shows new name (`/`, `/admin`, `/now-playing`, relay)
7. localStorage contains `<new-name>_token`, `<new-name>_device_id`, `<new-name>-theme`
8. Final scrub: `grep -ri "playplay" .` (excluding `node_modules`, `.git`, `pnpm-lock.yaml` regen artifacts) returns zero hits
