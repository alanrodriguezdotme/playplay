# Plan: Patron-network access (local + hosted modes)

The whole app currently assumes one LAN: server binds `0.0.0.0`, prints LAN URLs, patron QR encodes a `http://192.168.x.x:PORT` URL, web client uses `window.location.origin` for both API and Socket.IO. Patrons MUST be on the venue's Wi-Fi today. This plan adds two modes — keeping local but smoothing it, and a one-toggle public-URL option for venues where shared Wi-Fi isn't viable.

## Modes

### Mode A — Local (improved)

Same architecture as today, but eliminate "what's the Wi-Fi password" friction by generating a Wi-Fi join QR alongside the patron URL QR.

- Patron flow: open camera → scan Wi-Fi QR → tap "Join" → scan patron QR → done. (Two scans, no typing.)
- Admin flow: wizard captures SSID + password (optional, only if admin opts in).
- Wi-Fi QR format is a standard supported by iOS 11+ and Android 10+: `WIFI:T:WPA;S:<ssid>;P:<password>;H:false;;`.
- The display screen shows both QRs side-by-side when `wifiJoinConfig` is set; falls back to just the patron QR otherwise.
- Detecting current SSID at wizard time: Windows `netsh wlan show interfaces`, macOS `networksetup -getairportnetwork en0`, Linux `iwgetid -r`. Auto-fill the SSID prompt with it.
- Password storage: in DB encrypted with same `secrets.ts` AES-GCM helper used for Spotify creds.
- Best-practice add: also keep mDNS hostname (`<slug>.local`) — works reliably on iOS/macOS, less so on Android, but free to add via `bonjour-service` package.

### Mode B — Hosted (Cloudflare Quick Tunnel)

For venues without controllable Wi-Fi (coffee shops with captive portals, AP-isolated guest networks, outdoor events). The laptop opens an outbound tunnel to Cloudflare; patrons hit a public `https://<random>.trycloudflare.com` URL from anywhere.

- Patron flow: open camera → scan patron QR → done. (One scan, no Wi-Fi join.)
- Admin flow: wizard offers "Public URL via Cloudflare Tunnel"; installs `cloudflared` binary on first run; starts `cloudflared tunnel --url http://127.0.0.1:<PORT>` in a child process when server starts; reads the public URL from cloudflared's stdout/stderr; passes it to the QR generator.
- No Cloudflare account, no DNS, no domain — Quick Tunnels are anonymous and free. URL changes every run.
- Admin URL stays LAN-only (security: don't expose `/admin` over the internet by default).
- Implementation:
  - `packages/server/src/services/tunnel.ts` — spawn cloudflared, parse `https://...trycloudflare.com` from output, expose getter.
  - `packages/server/src/index.ts` — start tunnel after `server.listen` if enabled; print public URL alongside LAN URLs.
  - DB column `Venue.publicUrlMode` (`"none" | "cloudflare"`) and `publicUrlOverride` (for users who already have ngrok/their own tunnel).
  - QR generator picks `publicUrl` over `lanIp` when present.
- Bundling cloudflared: don't ship the binary; on first opt-in, the wizard downloads the appropriate platform binary from `https://github.com/cloudflare/cloudflared/releases/latest` to `packages/server/.bin/cloudflared(.exe)`.
- Persistent named tunnels (named subdomains, no re-roll) require a Cloudflare account + a user-owned domain — leave as a future "Pro mode."

### Mode C — Manual public URL

Power-user escape hatch. Admin enters their own public URL (ngrok, Tailscale Funnel, their own reverse proxy, custom domain pointing at home IP, etc.). The app uses it for the QR; otherwise no automation.

## Research notes

- **Cloudflare Quick Tunnels**: anonymous, free, HTTPS, no account needed. Good for v1 hosted mode. Drawback: random subdomain regenerates each run, so the patron QR changes — admin must redisplay. Acceptable since the QR lives on the venue display and updates automatically.
- **ngrok free tier**: requires account + authtoken, stable subdomain only on paid plans. Heavier integration; skip for v1.
- **Tailscale Funnel**: requires Tailscale install + auth on the venue server. Viable as Mode C escape hatch but not as a default — and Funnel exposes the device's hostname, which leaks identity.
- **mDNS (.local)**: nice-to-have. Eliminates the IP-address ugliness. Works iOS/macOS/most desktops; Android support is patchy (Chrome supports it on Android 10+, but Samsung Browser etc. may not). Don't rely on it as the only mechanism.
- **HTTPS on LAN via nip.io / sslip.io + Let's Encrypt DNS-01**: technically works, but requires a controlled domain. Not zero-config. Skip.
- **Captive portal**: requires hardware/router cooperation. Out of scope.

## Phases

### Phase 1 — Wi-Fi QR + mDNS (Mode A polish)

1. Wizard prompt: "Show patrons a Wi-Fi join QR? (Y/n)" → captures SSID (auto-detected) + password.
2. Encrypt + store on `Venue` row: `wifiSsid` (plain), `wifiPasswordEnc` (encrypted via existing `secrets.ts`), `wifiSecurity` (`"WPA" | "WEP" | "nopass"`).
3. Server endpoint: `GET /api/venue/wifi-qr` returns `{ payload: "WIFI:T:WPA;S:...;P:...;;" }`.
4. Display component: show Wi-Fi QR + caption above the patron QR when configured.
5. Admin Settings: section to edit / clear Wi-Fi credentials (relay-style "Replace / Clear" pattern).
6. mDNS advertisement: bind `<slug>.local` via `bonjour-service`. URL becomes `http://my-bar.local:1738` on iOS.

### Phase 2 — Cloudflare Tunnel (Mode B)

7. `packages/server/src/services/tunnel.ts`: Node helper to download cloudflared (with platform detection + checksum verification), spawn it, parse public URL, restart on crash.
8. Wizard prompt: "How will patrons connect?" → `Local Wi-Fi only` / `Public URL (Cloudflare Tunnel)` / `I'll provide my own URL`.
9. Persist `publicUrlMode` + `publicUrlOverride` on `Venue`.
10. `packages/server/src/index.ts`: when `publicUrlMode === "cloudflare"`, start tunnel after `server.listen`; expose current URL via `GET /api/venue/public-url`.
11. QR generator on display: prefer `publicUrl` from new endpoint; fall back to LAN URL.
12. Admin Settings: "Public access" section — toggle mode, view current public URL, "regenerate" button (restart tunnel).
13. Clear separation of `/admin` vs patron paths: optional middleware that, when a request hits the tunnel hostname AND path starts with `/admin`, returns 404 — prevents accidental internet exposure of the admin UI.

### Phase 3 — Documentation

14. README "How patrons connect" callout right under Quick Start: three modes, when to use each.
15. Wizard final banner: prints clearly which mode is active and how patrons will reach the venue.
16. Troubleshooting entries: AP isolation, captive portal, cloudflared binary firewall prompt, ISP blocking outbound 443 (extremely rare).

### Phase 4 — Future (not in this plan)

- Persistent named Cloudflare tunnel for users with their own domain (Pro mode).
- Captive-portal sidecar for venues that own their AP.

## Decisions to confirm

1. **Scope this round**: do all three phases now, or just Phase 1 (Wi-Fi QR + mDNS), or just Phase 2 (Cloudflare)? My rec: **Phase 1 first** — it's smaller, no new binaries, and covers the 80% case (a venue that owns its Wi-Fi). Phase 2 next as a follow-up.
2. **cloudflared distribution**: download on first opt-in vs ship in a release artifact. Rec: **download on opt-in**, with checksum.
3. **Mode B admin protection**: hard-block `/admin` over the tunnel hostname, or trust the existing JWT auth? Rec: **hard-block** — defense in depth, and there's no use case for hitting `/admin` from outside the LAN.
4. **mDNS**: include in Phase 1 (cheap, ~30 lines + a dep) or defer? Rec: **include** — the URL becomes `http://my-bar.local:1738` on iOS, much friendlier than IPs.

## Verification

1. Wi-Fi QR scans on iOS (Camera app) and Android (Google camera) → device joins the network.
2. Patron QR scans on the joined phone → loads patron app.
3. With Cloudflare mode enabled: cloudflared starts, public URL printed, QR encodes that URL, patron app loads from cellular (Wi-Fi off), `/admin` returns 404 over the tunnel hostname.
4. Admin URL still works on LAN regardless of mode.
5. mDNS: `http://<slug>.local:<port>` resolves on an iPhone.

## Files / symbols of note

- [packages/server/src/index.ts](packages/server/src/index.ts) — server bind + LAN URL printing
- [packages/server/src/lib/secrets.ts](packages/server/src/lib/secrets.ts) — reuse for Wi-Fi password encryption
- [packages/server/prisma/schema.prisma](packages/server/prisma/schema.prisma) — add `wifi*`, `publicUrl*` columns to `Venue`
- [packages/web/src/pages/display/components/DisplayQRCode.tsx](packages/web/src/pages/display/components/DisplayQRCode.tsx) — switch QR source
- [packages/web/src/api/client.ts](packages/web/src/api/client.ts) — currently relative URL; works with both modes unchanged
- [packages/web/src/contexts/SocketContext.tsx](packages/web/src/contexts/SocketContext.tsx) — same
- [scripts/setup.mjs](scripts/setup.mjs) — wizard prompts
- [packages/web/src/pages/admin/SettingsView.tsx](packages/web/src/pages/admin/SettingsView.tsx) — add Wi-Fi + Public Access sections
