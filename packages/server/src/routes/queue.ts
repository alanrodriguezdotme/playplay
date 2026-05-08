import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  addToQueue,
  voteOnEntry,
  getQueue,
  getHistory,
  removeEntry,
  playNow,
  reorderQueue,
  QueueError,
} from "../services/queue.js";
import { importSpotifyTrack } from "../services/spotify.js";
import { prisma, parseSettings } from "../lib/prisma.js";
import { QUEUE_STATUS, DEFAULTS } from "@playplay/shared";
import { getLocalIp } from "../services/network.js";
import { broadcastQueueUpdated, broadcastEntryAdded, broadcastEntryRemoved, broadcastNowPlayingChanged } from "../socket/broadcast.js";
import { advanceQueue } from "../services/playback.js";
import { getDefaultVenue } from "../lib/venue.js";

const router = Router();

// POST /api/queue/add — add a song to the queue
router.post("/add", authenticate, async (req, res, next) => {
  try {
    let { songId } = req.body;
    const { spotifyTrackId } = req.body;

    // If spotifyTrackId provided, auto-import it first
    if (!songId && spotifyTrackId && typeof spotifyTrackId === "string") {
      try {
        songId = await importSpotifyTrack(req.user!.venueId, spotifyTrackId);
      } catch (err) {
        res.status(400).json({ error: "spotify_import_failed", message: (err as Error).message });
        return;
      }
    }

    if (!songId || typeof songId !== "string") {
      res.status(400).json({ error: "bad_request", message: "songId or spotifyTrackId is required" });
      return;
    }

    const entry = await addToQueue(req.user!.id, songId, req.user!.venueId);
    res.status(201).json(entry);
    broadcastEntryAdded(req.user!.venueId, entry).catch(console.error);
    broadcastQueueUpdated(req.user!.venueId).catch(console.error);
  } catch (err) {
    if (err instanceof QueueError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/queue/:entryId/vote — vote on a queue entry
router.post("/:entryId/vote", authenticate, async (req, res, next) => {
  try {
    const { value } = req.body;
    if (value !== 1 && value !== -1 && value !== 0) {
      res.status(400).json({ error: "bad_request", message: "value must be 1, -1, or 0" });
      return;
    }

    const entry = await voteOnEntry(req.user!.id, req.params.entryId as string, value);
    res.json(entry);
    if (entry.status === QUEUE_STATUS.REMOVED) {
      broadcastEntryRemoved(req.user!.venueId, entry.id).catch(console.error);
    }
    broadcastQueueUpdated(req.user!.venueId).catch(console.error);
  } catch (err) {
    if (err instanceof QueueError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

// GET /api/queue — get current queue + now playing
router.get("/", authenticate, async (req, res, next) => {
  try {
    const result = await getQueue(req.user!.venueId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/queue/display-settings — no auth (for display view)
router.get("/display-settings", async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({ where: { id: (await getDefaultVenue()).id } });
    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const s = parseSettings(venue.settings);
    res.json({
      displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
      displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
      lanIp: getLocalIp(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/queue/now-playing — no auth (for display view)
router.get("/now-playing", async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({ where: { id: (await getDefaultVenue()).id } });
    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const entry = await prisma.queueEntry.findFirst({
      where: { venueId: venue.id, status: QUEUE_STATUS.PLAYING },
      include: {
        song: true,
        addedBy: { select: { id: true, displayName: true, avatarEmoji: true, role: true } },
      },
    });

    if (!entry) {
      res.json(null);
      return;
    }

    res.json({
      id: entry.id,
      song: {
        id: entry.song.id,
        title: entry.song.title,
        artist: entry.song.artist,
        album: entry.song.album,
        duration: entry.song.duration,
        totalPlays: entry.song.totalPlays,
        totalAdds: entry.song.totalAdds,
        isBlocked: entry.song.blocked,
      },
      addedBy: entry.addedBy
        ? { id: entry.addedBy.id, displayName: entry.addedBy.displayName, avatarEmoji: entry.addedBy.avatarEmoji ?? null, role: entry.addedBy.role }
        : null,
      status: entry.status,
      voteScore: entry.voteScore,
      createdAt: entry.createdAt.toISOString(),
      playedAt: entry.playedAt?.toISOString() ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/queue/history — paginated play history
router.get("/history", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const result = await getHistory(req.user!.venueId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/queue/:entryId — remove from queue (admin or the patron who added it)
router.delete("/:entryId", authenticate, async (req, res, next) => {
  try {
    const entry = await prisma.queueEntry.findFirst({
      where: { id: req.params.entryId as string, venueId: req.user!.venueId, status: QUEUE_STATUS.QUEUED },
    });
    if (!entry) {
      res.status(404).json({ error: "entry_not_found", message: "Queued entry not found" });
      return;
    }
    if (req.user!.role !== "admin" && entry.addedById !== req.user!.id) {
      res.status(403).json({ error: "forbidden", message: "You can only remove your own songs" });
      return;
    }
    await removeEntry(req.params.entryId as string, req.user!.venueId);
    res.status(204).end();
    broadcastEntryRemoved(req.user!.venueId, req.params.entryId as string).catch(console.error);
    broadcastQueueUpdated(req.user!.venueId).catch(console.error);
  } catch (err) {
    if (err instanceof QueueError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/queue/:entryId/play-now — admin play immediately
router.post("/:entryId/play-now", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const entry = await playNow(req.params.entryId as string, req.user!.venueId);
    res.json(entry);
    broadcastNowPlayingChanged(req.user!.venueId, entry).catch(console.error);
    broadcastQueueUpdated(req.user!.venueId).catch(console.error);
  } catch (err) {
    if (err instanceof QueueError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/queue/reorder — admin reorder queue
router.post("/reorder", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { entryIds } = req.body;
    if (!Array.isArray(entryIds) || !entryIds.every((id: unknown) => typeof id === "string")) {
      res.status(400).json({ error: "bad_request", message: "entryIds must be an array of strings" });
      return;
    }

    await reorderQueue(req.user!.venueId, entryIds);
    res.status(204).end();
    broadcastQueueUpdated(req.user!.venueId).catch(console.error);
  } catch (err) {
    if (err instanceof QueueError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

export default router;
