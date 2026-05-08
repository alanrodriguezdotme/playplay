import { Router } from "express";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { scanMusicLibrary } from "../services/music.js";
import { prisma, parseSettings, stringifySettings } from "../lib/prisma.js";
import { broadcastQueueUpdated } from "../socket/broadcast.js";
import { QUEUE_STATUS, DEFAULTS } from "@playplay/shared";
import type {
  AdminVenueSettingsUpdateBody,
  AdminVenueInfoUpdateBody,
  AdminUserUpdateBody,
  AdminSongUpdateBody,
  VenueSettings,
} from "@playplay/shared";

const router = Router();

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
    const s = parseSettings(venue.settings);
    res.json({
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      email: venue.email,
      phone: venue.phone,
      settings: {
        voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
        maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
        defaultPlaylistPath: (s.defaultPlaylistPath as string) ?? "",
        displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
        displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
        otpDeliveryMode: (s.otpDeliveryMode as string) ?? DEFAULTS.OTP_DELIVERY_MODE,
        smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
        musicSource: (s.musicSource as string) ?? DEFAULTS.MUSIC_SOURCE,
        allowFullCatalogSearch: (s.allowFullCatalogSearch as boolean) ?? DEFAULTS.ALLOW_FULL_CATALOG_SEARCH,
      },
    });
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

    const s = parseSettings(updated.settings);
    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      email: updated.email,
      phone: updated.phone,
      settings: {
        voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
        maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
        defaultPlaylistPath: (s.defaultPlaylistPath as string) ?? "",
        displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
        displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
        otpDeliveryMode: (s.otpDeliveryMode as string) ?? DEFAULTS.OTP_DELIVERY_MODE,
        smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
        musicSource: (s.musicSource as string) ?? DEFAULTS.MUSIC_SOURCE,
        allowFullCatalogSearch: (s.allowFullCatalogSearch as boolean) ?? DEFAULTS.ALLOW_FULL_CATALOG_SEARCH,
      },
    });
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

    const current = parseSettings(venue.settings);
    const merged: Record<string, unknown> = { ...current };

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
    if (body.defaultPlaylistPath !== undefined) {
      if (typeof body.defaultPlaylistPath !== "string") {
        res.status(400).json({ error: "validation", message: "defaultPlaylistPath must be a string" });
        return;
      }
      merged.defaultPlaylistPath = body.defaultPlaylistPath;
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

    const updated = await prisma.venue.update({
      where: { id: venue.id },
      data: { settings: stringifySettings(merged) },
    });

    const s = parseSettings(updated.settings);
    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      email: updated.email,
      phone: updated.phone,
      settings: {
        voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
        maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
        defaultPlaylistPath: (s.defaultPlaylistPath as string) ?? "",
        displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
        displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
        otpDeliveryMode: (s.otpDeliveryMode as string) ?? DEFAULTS.OTP_DELIVERY_MODE,
        smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
        musicSource: (s.musicSource as string) ?? DEFAULTS.MUSIC_SOURCE,
        allowFullCatalogSearch: (s.allowFullCatalogSearch as boolean) ?? DEFAULTS.ALLOW_FULL_CATALOG_SEARCH,
      },
    });
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
