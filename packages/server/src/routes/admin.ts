import { Router } from "express";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { scanMusicLibrary } from "../services/music.js";
import { applyDefaultPlaylistConfig } from "../services/defaultPlaylist.js";
import { clearFallbackCursor } from "../services/playbackState.js";
import { validateLocalPath, PathValidationError } from "../lib/paths.js";
import { prisma, stringifySettings } from "../lib/prisma.js";
import { getVenueSettings } from "../lib/settings.js";
import { broadcastQueueUpdated } from "../socket/broadcast.js";
import { QUEUE_STATUS } from "@playplay/shared";
import type {
  AdminVenueSettingsUpdateBody,
  AdminVenueInfoUpdateBody,
  AdminUserUpdateBody,
  AdminSongUpdateBody,
  DefaultPlaylistConfig,
  VenueSettings,
} from "@playplay/shared";

const router: Router = Router();

function venueResponse(venue: {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  settings: string;
}) {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    email: venue.email,
    phone: venue.phone,
    settings: getVenueSettings(venue),
  };
}

function validateDefaultPlaylist(input: unknown): DefaultPlaylistConfig | { error: string } {
  if (!input || typeof input !== "object") return { error: "defaultPlaylist must be an object" };
  const obj = input as Record<string, unknown>;
  const source = obj.source;
  if (source !== "history" && source !== "local" && source !== "spotify") {
    return { error: "defaultPlaylist.source must be 'history', 'local', or 'spotify'" };
  }
  const shuffle = typeof obj.shuffle === "boolean" ? obj.shuffle : true;
  const out: DefaultPlaylistConfig = { source, shuffle };

  if (source === "local") {
    if (!obj.local || typeof obj.local !== "object") return { error: "defaultPlaylist.local is required for source=local" };
    const l = obj.local as Record<string, unknown>;
    if (l.kind !== "folder" && l.kind !== "m3u") return { error: "defaultPlaylist.local.kind must be 'folder' or 'm3u'" };
    if (typeof l.path !== "string" || l.path.trim().length === 0) return { error: "defaultPlaylist.local.path is required" };
    out.local = { kind: l.kind, path: l.path };
  }

  if (source === "spotify") {
    if (!obj.spotify || typeof obj.spotify !== "object") return { error: "defaultPlaylist.spotify is required for source=spotify" };
    const sp = obj.spotify as Record<string, unknown>;
    if (typeof sp.playlistId !== "string" || sp.playlistId.trim().length === 0) return { error: "defaultPlaylist.spotify.playlistId is required" };
    out.spotify = {
      playlistId: sp.playlistId,
      playlistName: typeof sp.playlistName === "string" ? sp.playlistName : "",
      ownerName: typeof sp.ownerName === "string" ? sp.ownerName : "",
      trackCount: typeof sp.trackCount === "number" ? sp.trackCount : 0,
      lastSyncedAt: typeof sp.lastSyncedAt === "string" ? sp.lastSyncedAt : null,
    };
  }

  if (source === "history") {
    const h = (obj.history as Record<string, unknown>) ?? {};
    out.history = {
      lookbackDays: typeof h.lookbackDays === "number" && h.lookbackDays > 0 ? h.lookbackDays : null,
    };
  }

  return out;
}

function defaultPlaylistChanged(a: DefaultPlaylistConfig, b: DefaultPlaylistConfig): boolean {
  if (a.source !== b.source) return true;
  if (a.shuffle !== b.shuffle) return true;
  if (a.source === "local") {
    return a.local?.kind !== b.local?.kind || a.local?.path !== b.local?.path;
  }
  if (a.source === "spotify") {
    return a.spotify?.playlistId !== b.spotify?.playlistId;
  }
  if (a.source === "history") {
    return (a.history?.lookbackDays ?? null) !== (b.history?.lookbackDays ?? null);
  }
  return false;
}

// ---- Venue ----

// GET /api/admin/venue
router.get("/venue", async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });
    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }
    res.json(venueResponse(venue));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/venue
router.patch("/venue", async (req, res, next) => {
  try {
    const body = req.body as AdminVenueInfoUpdateBody;
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });
    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const data: Record<string, string> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        res.status(400).json({ error: "validation", message: "name must be a non-empty string" });
        return;
      }
      data.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string") {
        res.status(400).json({ error: "validation", message: "email must be a string" });
        return;
      }
      data.email = body.email.trim();
    }
    if (body.phone !== undefined) {
      if (typeof body.phone !== "string") {
        res.status(400).json({ error: "validation", message: "phone must be a string" });
        return;
      }
      data.phone = body.phone.trim();
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "validation", message: "No fields to update" });
      return;
    }

    const updated = await prisma.venue.update({
      where: { id: venue.id },
      data,
    });

    res.json(venueResponse(updated));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/venue/settings
router.patch("/venue/settings", async (req, res, next) => {
  try {
    const body = req.body as AdminVenueSettingsUpdateBody;
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });
    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const currentSettings: VenueSettings = getVenueSettings(venue);
    const merged: Record<string, unknown> = { ...currentSettings };
    let nextDefaultPlaylist: DefaultPlaylistConfig | null = null;

    if (body.voteThreshold !== undefined) {
      if (typeof body.voteThreshold !== "number") {
        res.status(400).json({ error: "validation", message: "voteThreshold must be a number" });
        return;
      }
      merged.voteThreshold = body.voteThreshold;
    }
    if (body.maxSongsPerUser !== undefined) {
      if (typeof body.maxSongsPerUser !== "number" || body.maxSongsPerUser < 1) {
        res.status(400).json({ error: "validation", message: "maxSongsPerUser must be >= 1" });
        return;
      }
      merged.maxSongsPerUser = body.maxSongsPerUser;
    }
    if (body.defaultPlaylist !== undefined) {
      const parsed = validateDefaultPlaylist(body.defaultPlaylist);
      if ("error" in parsed) {
        res.status(400).json({ error: "validation", message: parsed.error });
        return;
      }
      nextDefaultPlaylist = parsed;
      merged.defaultPlaylist = parsed;
      // Drop the legacy field if it exists in storage
      delete (merged as Record<string, unknown>).defaultPlaylistPath;
    }
    if (body.displayQrSize !== undefined) {
      if (typeof body.displayQrSize !== "number" || body.displayQrSize < 60 || body.displayQrSize > 300) {
        res.status(400).json({ error: "validation", message: "displayQrSize must be between 60 and 300" });
        return;
      }
      merged.displayQrSize = body.displayQrSize;
    }
    if (body.displayShowHeader !== undefined) {
      if (typeof body.displayShowHeader !== "boolean") {
        res.status(400).json({ error: "validation", message: "displayShowHeader must be a boolean" });
        return;
      }
      merged.displayShowHeader = body.displayShowHeader;
    }
    if (body.displayTheme !== undefined) {
      const validThemes = ["dark", "light", "midnight", "sunset", "synthwave", "country", "disco", "punk", "pop", "hiphop"];
      if (typeof body.displayTheme !== "string" || !validThemes.includes(body.displayTheme)) {
        res.status(400).json({ error: "validation", message: "Invalid displayTheme" });
        return;
      }
      merged.displayTheme = body.displayTheme;
    }
    if (body.otpDeliveryMode !== undefined) {
      const validModes = ["none", "venue-display", "sms-gateway", "paid"];
      if (!validModes.includes(body.otpDeliveryMode)) {
        res.status(400).json({ error: "validation", message: "Invalid otpDeliveryMode" });
        return;
      }
      merged.otpDeliveryMode = body.otpDeliveryMode;
    }
    if (body.smsGatewayUrl !== undefined) {
      if (typeof body.smsGatewayUrl !== "string") {
        res.status(400).json({ error: "validation", message: "smsGatewayUrl must be a string" });
        return;
      }
      merged.smsGatewayUrl = body.smsGatewayUrl;
    }
    if (body.musicSource !== undefined) {
      const validSources = ["local", "spotify"];
      if (!validSources.includes(body.musicSource)) {
        res.status(400).json({ error: "validation", message: "musicSource must be 'local' or 'spotify'" });
        return;
      }
      merged.musicSource = body.musicSource;
    }
    if (body.allowFullCatalogSearch !== undefined) {
      if (typeof body.allowFullCatalogSearch !== "boolean") {
        res.status(400).json({ error: "validation", message: "allowFullCatalogSearch must be a boolean" });
        return;
      }
      merged.allowFullCatalogSearch = body.allowFullCatalogSearch;
    }

    // Apply default-playlist rebuild before persisting (so we can capture
    // enriched metadata like Spotify's lastSyncedAt) and reject on errors.
    if (nextDefaultPlaylist && defaultPlaylistChanged(currentSettings.defaultPlaylist, nextDefaultPlaylist)) {
      const libraryRoot = resolve(process.env.MUSIC_LIBRARY_PATH || "./music");
      try {
        const enriched = await applyDefaultPlaylistConfig(venue.id, nextDefaultPlaylist, libraryRoot);
        merged.defaultPlaylist = enriched;
        clearFallbackCursor(venue.id);
      } catch (err) {
        res.status(400).json({
          error: "default_playlist_rebuild_failed",
          message: err instanceof Error ? err.message : "Failed to apply default playlist",
        });
        return;
      }
    } else if (nextDefaultPlaylist) {
      // Same source identity but maybe shuffle changed — just reset cursor
      clearFallbackCursor(venue.id);
    }

    const updated = await prisma.venue.update({
      where: { id: venue.id },
      data: { settings: stringifySettings(merged) },
    });

    res.json(venueResponse(updated));
  } catch (err) {
    next(err);
  }
});

// ---- Users ----

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const venueId = req.user!.venueId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const roleFilter = req.query.role as string | undefined;
    const blockedFilter = req.query.blocked as string | undefined;

    const where: any = { venueId };

    if (search) {
      where.OR = [
        { displayName: { contains: search } },
        { phone: { contains: search } },
        { deviceId: { contains: search } },
      ];
    }
    if (roleFilter === "ADMIN" || roleFilter === "PATRON") {
      where.role = roleFilter;
    }
    if (blockedFilter === "true") {
      where.blocked = true;
    } else if (blockedFilter === "false") {
      where.blocked = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        deviceId: u.deviceId,
        displayName: u.displayName,
        avatarEmoji: u.avatarEmoji,
        role: u.role,
        blocked: u.blocked,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", async (req, res, next) => {
  try {
    const venueId = req.user!.venueId;
    const userId = req.params.id;
    const body = req.body as AdminUserUpdateBody;

    const user = await prisma.user.findFirst({
      where: { id: userId, venueId },
    });
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    // Prevent self-demotion
    if (userId === req.user!.id && body.role && body.role !== "ADMIN") {
      res.status(400).json({ error: "self_demotion", message: "Cannot remove your own admin role" });
      return;
    }

    const data: any = {};
    if (body.blocked !== undefined) data.blocked = body.blocked;
    if (body.role !== undefined) {
      if (body.role !== "ADMIN" && body.role !== "PATRON") {
        res.status(400).json({ error: "validation", message: "Role must be ADMIN or PATRON" });
        return;
      }
      data.role = body.role;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // If blocking, remove their queued entries
    if (body.blocked === true) {
      const removed = await prisma.queueEntry.updateMany({
        where: { addedById: userId, venueId, status: QUEUE_STATUS.QUEUED },
        data: { status: QUEUE_STATUS.REMOVED },
      });
      if (removed.count > 0) {
        broadcastQueueUpdated(venueId).catch(console.error);
      }
    }

    res.json({
      id: updated.id,
      phone: updated.phone,
      deviceId: updated.deviceId,
      displayName: updated.displayName,
      avatarEmoji: updated.avatarEmoji,
      role: updated.role,
      blocked: updated.blocked,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- Songs ----

// PATCH /api/admin/songs/:id
router.patch("/songs/:id", async (req, res, next) => {
  try {
    const venueId = req.user!.venueId;
    const songId = req.params.id;
    const body = req.body as AdminSongUpdateBody;

    const song = await prisma.song.findFirst({
      where: { id: songId, venueId },
    });
    if (!song) {
      res.status(404).json({ error: "not_found", message: "Song not found" });
      return;
    }

    if (typeof body.blocked !== "boolean") {
      res.status(400).json({ error: "validation", message: "blocked must be a boolean" });
      return;
    }

    const updated = await prisma.song.update({
      where: { id: songId },
      data: { blocked: body.blocked },
    });

    // If blocking, remove queued entries for this song
    if (body.blocked === true) {
      const removed = await prisma.queueEntry.updateMany({
        where: { songId, venueId, status: QUEUE_STATUS.QUEUED },
        data: { status: QUEUE_STATUS.REMOVED },
      });
      if (removed.count > 0) {
        broadcastQueueUpdated(venueId).catch(console.error);
      }
    }

    res.json({
      id: updated.id,
      title: updated.title,
      artist: updated.artist,
      album: updated.album,
      duration: updated.duration,
      filePath: updated.filePath,
      blocked: updated.blocked,
      isDefault: updated.isDefault,
      isFallbackOnly: updated.isFallbackOnly,
      totalPlays: updated.totalPlays,
      totalAdds: updated.totalAdds,
      createdAt: updated.createdAt.toISOString(),
      source: updated.source,
      spotifyTrackId: updated.spotifyTrackId,
      artworkUrl: updated.artworkUrl,
    });
  } catch (err) {
    next(err);
  }
});

// ---- Stats ----

// GET /api/admin/stats
router.get("/stats", async (req, res, next) => {
  try {
    const venueId = req.user!.venueId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalSongs,
      totalUnblockedSongs,
      totalUsers,
      activeUsersToday,
      totalPlayed,
      totalQueued,
      topSongs,
      recentActivity,
    ] = await Promise.all([
      prisma.song.count({ where: { venueId } }),
      prisma.song.count({ where: { venueId, blocked: false } }),
      prisma.user.count({ where: { venueId } }),
      prisma.queueEntry.findMany({
        where: {
          venueId,
          createdAt: { gte: todayStart },
          addedById: { not: null },
        },
        select: { addedById: true },
        distinct: ["addedById"],
      }).then((r) => r.length),
      prisma.queueEntry.count({ where: { venueId, status: QUEUE_STATUS.PLAYED } }),
      prisma.queueEntry.count({ where: { venueId, status: QUEUE_STATUS.QUEUED } }),
      prisma.song.findMany({
        where: { venueId, blocked: false },
        orderBy: { totalPlays: "desc" },
        take: 5,
        select: { id: true, title: true, artist: true, totalPlays: true },
      }),
      prisma.queueEntry.findMany({
        where: { venueId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          song: true,
          addedBy: { select: { id: true, displayName: true, avatarEmoji: true, role: true } },
          votes: { select: { userId: true, value: true } },
        },
      }),
    ]);

    res.json({
      totalSongs,
      totalUnblockedSongs,
      totalUsers,
      activeUsersToday,
      totalPlayed,
      totalQueued,
      topSongs,
      recentActivity: recentActivity.map((e) => ({
        id: e.id,
        song: {
          id: e.song.id,
          title: e.song.title,
          artist: e.song.artist,
          album: e.song.album,
          duration: e.song.duration,
          totalPlays: e.song.totalPlays,
          totalAdds: e.song.totalAdds,
          isBlocked: e.song.blocked,
        },
        addedBy: e.addedBy
          ? { id: e.addedBy.id, displayName: e.addedBy.displayName, avatarEmoji: e.addedBy.avatarEmoji ?? null, role: e.addedBy.role }
          : null,
        status: e.status,
        voteScore: e.voteScore,
        currentUserVote: null,
        createdAt: e.createdAt.toISOString(),
        playedAt: e.playedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---- Default Playlist Path Validation ----
// POST /api/admin/default-playlist/validate-path { kind: "folder" | "m3u", path: string }
router.post("/default-playlist/validate-path", async (req, res, next) => {
  try {
    const { kind, path } = req.body ?? {};
    if (kind !== "folder" && kind !== "m3u") {
      res.status(400).json({ error: "validation", message: "kind must be 'folder' or 'm3u'" });
      return;
    }
    if (typeof path !== "string" || path.trim().length === 0) {
      res.status(400).json({ error: "validation", message: "path is required" });
      return;
    }
    const libraryRoot = resolve(process.env.MUSIC_LIBRARY_PATH || "./music");
    try {
      const canonical = await validateLocalPath(path, {
        baseDir: libraryRoot,
        allowUnc: true,
        allowAbsoluteOutsideBase: true,
        mustExist: true,
        mustBeFile: kind === "m3u",
        mustBeDirectory: kind === "folder",
      });
      res.json({ valid: true, canonical });
    } catch (err) {
      if (err instanceof PathValidationError) {
        res.status(400).json({ valid: false, error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ---- Music Scan ----
router.post("/music/scan", async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });

    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const libraryPath = resolve(
      process.env.MUSIC_LIBRARY_PATH || "./music"
    );

    const result = await scanMusicLibrary(venue.id, libraryPath);

    console.log(
      `[Music Scan] venue=${venue.slug}: added=${result.added} updated=${result.updated} removed=${result.removed} errors=${result.errors.length}`
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- Password ----

// PATCH /api/admin/change-password
router.patch("/change-password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "BAD_REQUEST", message: "currentPassword and newPassword are required" });
      return;
    }

    if (typeof newPassword !== "string" || newPassword.length < 4) {
      res.status(400).json({ error: "BAD_REQUEST", message: "newPassword must be at least 4 characters" });
      return;
    }

    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });
    if (!venue) {
      res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, venue.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.venue.update({
      where: { id: venue.id },
      data: { passwordHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
