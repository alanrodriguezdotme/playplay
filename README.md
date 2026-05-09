# PlayPlay Venue

A self-hosted, collaborative jukebox for venues. Patrons scan a QR code, suggest songs, and vote on the queue from their phone. The Now Playing screen runs on a TV. You run it on a laptop.

Music can come from a **local folder of MP3s** (fully offline) or from **Spotify** (requires Spotify Premium).

## Quick start

You need **Node.js 20 or newer**. Everything else is bootstrapped automatically.

```bash
git clone <repo-url> playplay-venue
cd playplay-venue
node scripts/setup.mjs
```

The wizard will:

1. Bootstrap `pnpm` via corepack and install dependencies.
2. Ask for your venue name, admin email + password, music source, and (optionally) Spotify credentials.
3. Initialize the database, build the app, and offer to start the server.

When it finishes you'll see a banner like:

```
Reachable at:
  http://127.0.0.1:3001
  http://192.168.1.42:3001
```

Share the LAN URL (or scan the QR code) with patrons on the same Wi-Fi.

| Path           | Who it's for                                    |
| -------------- | ----------------------------------------------- |
| `/`            | Patrons (mobile-first queue + search)           |
| `/admin`       | You — sign in with the email + password you set |
| `/now-playing` | Big-screen display (open on the venue TV)       |

To re-run the wizard later: `pnpm setup --reconfigure`.
To start without re-prompting: `pnpm start`.

## Double-click launchers

After the first wizard run, the launchers in `scripts/launchers/` become double-clickable shortcuts:

- macOS — `setup.command`, `start.command`
- Windows — `setup.bat`, `start.bat`
- Linux — `setup.sh`, `start.sh`

`start.*` opens the admin page in your browser once the server is up. On macOS the first double-click of a `.command` file is blocked by Gatekeeper — right-click → Open the first time.

## Spotify setup

If you picked Spotify in the wizard (or want to add it later from **Admin → Settings**), you need a free Spotify Developer app:

1. Go to <https://developer.spotify.com/dashboard> and click **Create app**.
2. Any name and description work; the website URL can be blank.
3. Add this exact **Redirect URI** to your app and save:
   ```
   https://spotify-relay.vercel.app
   ```
4. Copy the **Client ID** and **Client Secret** into the wizard or the Admin Settings page.

You also need a **Spotify Premium** account on the device that does the actual playback (Premium is a Spotify requirement for Web Playback SDK streaming, not ours).

### Why a relay?

Spotify only allows HTTPS redirect URIs (or `127.0.0.1`). Your venue's install runs over HTTP on a LAN IP like `192.168.1.42`, which Spotify rejects. The relay is a tiny static page hosted at <https://spotify-relay.vercel.app> that receives the OAuth callback over HTTPS and bounces it back to your local server.

The shared relay is fine for personal use. If you'd rather not depend on it, host your own (it's the single HTML file in [`packages/spotify-relay/`](packages/spotify-relay/index.html) — deploy free to Vercel, Netlify, or Cloudflare Pages) and override `SPOTIFY_RELAY_URL` in the Admin Settings → Spotify Credentials section.

## Updating

```bash
git pull
pnpm setup
```

`pnpm setup` is idempotent — without `--reconfigure` it skips prompts, runs any new database migrations, rebuilds, and starts the server.

## Troubleshooting

- **Port already in use** — pass a different port to the wizard (`pnpm setup --reconfigure`) or edit `PORT=` in `packages/server/.env`.
- **Patrons can't reach the URL** — make sure they're on the same Wi-Fi network and your firewall allows incoming connections to the chosen port. On Windows, allow `node.exe` through the Windows Defender Firewall when prompted.
- **macOS won't run `.command` file** — right-click the file in Finder and choose **Open** (one-time Gatekeeper bypass).
- **Forgot the admin password** — re-run `pnpm setup --reconfigure`. Existing songs and queue history are preserved.
- **Spotify says "Invalid redirect URI"** — make sure the Redirect URI in your Spotify app matches `https://spotify-relay.vercel.app` _exactly_ (no trailing slash, no extra path).

## Development

```bash
pnpm dev   # runs the server (3001) + Vite dev server (1738) with HMR
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more.
