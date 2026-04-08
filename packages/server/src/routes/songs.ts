import { Router } from "express";
import { createReadStream, statSync } from "node:fs";
import { access } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

// GET /api/songs — paginated song list
router.get("/", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where = { venueId: req.user!.venueId, blocked: false };

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ artist: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          duration: true,
          totalPlays: true,
          totalAdds: true,
          blocked: true,
        },
      }),
      prisma.song.count({ where }),
    ]);

    res.json({
      songs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/songs/search?q= — text search on title + artist
router.get("/search", authenticate, async (req, res, next) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q) {
      res.json({ songs: [], total: 0 });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where = {
      venueId: req.user!.venueId,
      blocked: false,
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { artist: { contains: q, mode: "insensitive" as const } },
      ],
    };

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ artist: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          duration: true,
          totalPlays: true,
          totalAdds: true,
          blocked: true,
        },
      }),
      prisma.song.count({ where }),
    ]);

    res.json({ songs, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/songs/:id/stream — audio streaming with range requests (no auth — needed for Now Playing display)
router.get("/:id/stream", async (req, res, next) => {
  try {
    const song = await prisma.song.findUnique({
      where: { id: req.params.id },
    });

    if (!song) {
      res.status(404).json({ error: "not_found", message: "Song not found" });
      return;
    }

    const libraryPath = resolve(process.env.MUSIC_LIBRARY_PATH || "./music");
    const filePath = join(libraryPath, song.filePath);

    try {
      await access(filePath);
    } catch {
      res.status(404).json({ error: "file_not_found", message: "Audio file not found on disk" });
      return;
    }

    const fileStat = statSync(filePath);
    const fileSize = fileStat.size;
    const ext = extname(song.filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        res.end();
        return;
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      res.setHeader("Content-Type", contentType);

      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", "bytes");

      createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
