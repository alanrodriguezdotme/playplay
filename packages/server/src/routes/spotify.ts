import { Router } from "express";
import {
    getAuthUrl,
    handleCallback,
    getStatus,
    disconnect,
    getAccessToken,
    searchTracks,
    importSpotifyTrack,
    getDevices,
    transferPlayback,
    listMyPlaylists,
    searchPlaylists,
    getPlaylistMeta,
    SpotifyPremiumRequiredError,
} from "../services/spotify.js";
import { rebuildSpotifyFallbackPool } from "../services/defaultPlaylist.js";
import { clearFallbackCursor } from "../services/playbackState.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { prisma, stringifySettings } from "../lib/prisma.js";
import { getVenueSettings } from "../lib/settings.js";

const router: Router = Router();

// GET /api/spotify/auth-url — initiate OAuth (admin only)
router.get("/auth-url", authenticate, requireAdmin, async (req, res, next) => {
    try {
        if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
            res.status(400).json({
                error: "spotify_not_configured",
                message: "Spotify credentials are not configured on the server",
            });
            return;
        }
        if (!process.env.SPOTIFY_RELAY_URL) {
            res.status(400).json({
                error: "spotify_not_configured",
                message: "SPOTIFY_RELAY_URL is not configured on the server",
            });
            return;
        }
        const returnUrl = (req.query.returnUrl as string) || "";
        const url = getAuthUrl(req.user!.venueId, returnUrl);
        res.json({ url });
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/callback — OAuth callback from Spotify
router.get("/callback", async (req, res, next) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string; // venueId
        const error = req.query.error as string;

        if (error) {
            res.redirect(`/admin/settings?spotify_error=${encodeURIComponent(error)}`);
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: "invalid_callback", message: "Missing code or state" });
            return;
        }

        // Verify the venue exists
        const venue = await prisma.venue.findUnique({ where: { id: state } });
        if (!venue) {
            res.status(400).json({ error: "invalid_state", message: "Invalid venue" });
            return;
        }

        try {
            await handleCallback(code, state);
            res.redirect("/admin/settings?spotify_connected=true");
        } catch (err) {
            if (err instanceof SpotifyPremiumRequiredError) {
                res.redirect(`/admin/settings?spotify_error=${encodeURIComponent(err.message)}`);
                return;
            }
            throw err;
        }
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/callback-local — receives code from the hosted relay page
router.get("/callback-local", async (req, res, next) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string; // venueId
        const error = req.query.error as string;
        const returnUrl = req.query.returnUrl as string || "";

        const redirectToAdmin = (query: string) => {
            if (returnUrl) {
                const sep = returnUrl.includes("?") ? "&" : "?";
                res.redirect(`${returnUrl}${sep}${query}`);
            } else {
                // Fallback: serve an HTML page that shows the result
                res.setHeader("Content-Type", "text/html");
                res.send(`<!DOCTYPE html><html><body>
                  <p>Spotify connected! You can close this tab and return to admin settings.</p>
                  </body></html>`);
            }
        };

        if (error) {
            redirectToAdmin(`spotify_error=${encodeURIComponent(error)}`);
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: "invalid_callback", message: "Missing code or state" });
            return;
        }

        const venue = await prisma.venue.findUnique({ where: { id: state } });
        if (!venue) {
            res.status(400).json({ error: "invalid_state", message: "Invalid venue" });
            return;
        }

        try {
            await handleCallback(code, state);
            redirectToAdmin("spotify_connected=true");
        } catch (err) {
            if (err instanceof SpotifyPremiumRequiredError) {
                redirectToAdmin(`spotify_error=${encodeURIComponent(err.message)}`);
                return;
            }
            throw err;
        }
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/status — check connection status (admin only)
router.get("/status", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const status = await getStatus(req.user!.venueId);
        res.json(status);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/spotify/disconnect — remove Spotify connection (admin only)
router.delete("/disconnect", authenticate, requireAdmin, async (req, res, next) => {
    try {
        await disconnect(req.user!.venueId);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/token — get current access token for Web Playback SDK (admin only)
router.get("/token", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const token = await getAccessToken(req.user!.venueId);
        res.json(token);
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/search?q= — search Spotify catalog (authenticated users)
router.get("/search", authenticate, async (req, res, next) => {
    try {
        const q = (req.query.q as string || "").trim();
        if (!q) {
            res.json({ tracks: [], total: 0 });
            return;
        }
        const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 10));
        const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

        const result = await searchTracks(req.user!.venueId, q, limit, offset);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/spotify/import — import a Spotify track into the venue library (admin only)
router.post("/import", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { spotifyTrackId } = req.body;
        if (!spotifyTrackId || typeof spotifyTrackId !== "string") {
            res.status(400).json({ error: "validation", message: "spotifyTrackId is required" });
            return;
        }
        const songId = await importSpotifyTrack(req.user!.venueId, spotifyTrackId);
        res.json({ songId });
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/devices — list available Spotify Connect devices (admin only)
router.get("/devices", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const devices = await getDevices(req.user!.venueId);
        res.json({ devices });
    } catch (err) {
        next(err);
    }
});

// PUT /api/spotify/transfer — transfer playback to a device (admin only)
router.put("/transfer", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ error: "validation", message: "deviceId is required" });
            return;
        }
        await transferPlayback(req.user!.venueId, deviceId);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/spotify/playlists?q=... — list user's playlists (no q) or search public catalog (with q)
router.get("/playlists", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const q = (req.query.q as string || "").trim();
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || (q ? 20 : 50)));
        const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
        const result = q
            ? await searchPlaylists(req.user!.venueId, q, limit, offset)
            : await listMyPlaylists(req.user!.venueId, limit, offset);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/spotify/default-playlist/sync — re-import the currently-configured default playlist
router.post("/default-playlist/sync", authenticate, requireAdmin, async (req, res, next) => {
    try {
        const venue = await prisma.venue.findUnique({ where: { id: req.user!.venueId } });
        if (!venue) {
            res.status(404).json({ error: "not_found", message: "Venue not found" });
            return;
        }
        const settings = getVenueSettings(venue);
        if (settings.defaultPlaylist.source !== "spotify" || !settings.defaultPlaylist.spotify?.playlistId) {
            res.status(400).json({ error: "no_spotify_playlist", message: "No Spotify default playlist configured" });
            return;
        }
        const playlistId = settings.defaultPlaylist.spotify.playlistId;
        let result;
        try {
            result = await rebuildSpotifyFallbackPool(venue.id, playlistId);
        } catch (err) {
            res.status(400).json({
                error: "sync_failed",
                message: err instanceof Error ? err.message : "Failed to sync playlist",
            });
            return;
        }

        const meta = await getPlaylistMeta(venue.id, playlistId).catch(() => null);
        const next = {
            ...settings,
            defaultPlaylist: {
                ...settings.defaultPlaylist,
                spotify: {
                    playlistId,
                    playlistName: meta?.name ?? result.playlistName ?? settings.defaultPlaylist.spotify.playlistName,
                    ownerName: meta?.ownerName ?? result.ownerName ?? settings.defaultPlaylist.spotify.ownerName,
                    trackCount: result.trackCount,
                    lastSyncedAt: new Date().toISOString(),
                },
            },
        };
        await prisma.venue.update({
            where: { id: venue.id },
            data: { settings: stringifySettings(next as unknown as Record<string, unknown>) },
        });
        clearFallbackCursor(venue.id);

        res.json({
            trackCount: result.trackCount,
            errors: result.errors,
            spotify: next.defaultPlaylist.spotify,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
