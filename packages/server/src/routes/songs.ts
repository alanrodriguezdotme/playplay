import { Router } from "express";
import { createReadStream, statSync } from "node:fs";
import { access } from "node:fs/promises";
import { isAbsolute, join, resolve, extname } from "node:path";
import { parseFile } from "music-metadata";
import { prisma, parseSettings } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { DEFAULTS } from "@playplay/shared";
import { getVenueSettings, getLibraryRoot } from "../lib/settings.js";
import { isUnderPath } from "../lib/paths.js";

const router: Router = Router();

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

/**
 * Resolve a Song's stored filePath to an absolute on-disk path, enforcing that
 * fallback-only rows can only point at the configured default-playlist source
 * (so a malicious DB row can't be used to read arbitrary files).
 */
async function resolveSongFilePath(song: {
  filePath: string | null;
  isFallbackOnly: boolean;
  venueId: string;
}, libraryRoot: string): Promise<string | null> {
  if (!song.filePath) return null;

  // Library-relative path
  if (!isAbsolute(song.filePath) && !song.filePath.startsWith("\\\\") && !song.filePath.startsWith("//")) {
    return join(libraryRoot, song.filePath);
  }

  // Absolute or UNC: only allowed for fallback-only rows, and must be under the
  // currently-configured default playlist source.
  if (!song.isFallbackOnly) return null;

  const venue = await prisma.venue.findUnique({ where: { id: song.venueId } });
  if (!venue) return null;
  const settings = getVenueSettings(venue);
  const config = settings.defaultPlaylist;
  if (config.source !== "local" || !config.local?.path) return null;

  const sourcePath = resolve(config.local.path);
  // For folder source: file must be inside the folder.
  // For m3u source: the m3u file is at sourcePath; allowed entries can live anywhere
  // the m3u points to, so we trust the row (it was vetted at rebuild time).
  if (config.local.kind === "folder") {
    if (!isUnderPath(song.filePath, sourcePath)) return null;
  }
  return song.filePath;
}

// GET /api/songs/music-source — public: returns music source settings for the venue
router.get("/music-source", authenticate, async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });
    if (!venue) {
      res.json({ musicSource: "local" });
      return;
    }
    const s = parseSettings(venue.settings);
    res.json({
      musicSource: (s.musicSource as string) ?? DEFAULTS.MUSIC_SOURCE,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/songs — paginated song list
router.get("/", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where = { venueId: req.user!.venueId, blocked: false, isFallbackOnly: false };

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
          source: true,
          spotifyTrackId: true,
          artworkUrl: true,
          previewUrl: true,
          spotifyUri: true,
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
      isFallbackOnly: false,
      OR: [
        { title: { contains: q } },
        { artist: { contains: q } },
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
          source: true,
          spotifyTrackId: true,
          artworkUrl: true,
          previewUrl: true,
          spotifyUri: true,
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

    // Spotify songs are streamed via the Spotify SDK, not via the server
    if (song.source === "spotify") {
      res.status(403).json({ error: "spotify_stream", message: "Spotify songs are played via the Spotify SDK" });
      return;
    }

    if (!song.filePath) {
      res.status(404).json({ error: "file_not_found", message: "No audio file for this song" });
      return;
    }

    const venue = await prisma.venue.findUnique({ where: { id: song.venueId } });
    const libraryPath = venue
      ? getLibraryRoot(getVenueSettings(venue))
      : resolve(process.env.MUSIC_LIBRARY_PATH || "./music");
    const filePath = await resolveSongFilePath(song, libraryPath);
    if (!filePath) {
      res.status(403).json({ error: "forbidden", message: "This song's file path is no longer accessible" });
      return;
    }

    try {
      await access(filePath);
    } catch {
      res.status(404).json({ error: "file_not_found", message: "Audio file not found on disk" });
      return;
    }

    const fileStat = statSync(filePath);
    const fileSize = fileStat.size;
    const ext = extname(filePath).toLowerCase();
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

// GET /api/songs/:id/artwork — album art extracted from embedded metadata (no auth)
router.get("/:id/artwork", async (req, res, next) => {
  try {
    const song = await prisma.song.findUnique({
      where: { id: req.params.id },
    });

    if (!song) {
      res.status(404).json({ error: "not_found", message: "Song not found" });
      return;
    }

    // For Spotify songs, redirect to the artwork URL
    if (song.source === "spotify") {
      if (song.artworkUrl) {
        res.redirect(song.artworkUrl);
      } else {
        res.status(404).json({ error: "no_artwork", message: "No artwork available" });
      }
      return;
    }

    if (!song.filePath) {
      res.status(404).json({ error: "file_not_found", message: "No audio file for this song" });
      return;
    }

    const venue = await prisma.venue.findUnique({ where: { id: song.venueId } });
    const libraryPath = venue
      ? getLibraryRoot(getVenueSettings(venue))
      : resolve(process.env.MUSIC_LIBRARY_PATH || "./music");
    const filePath = await resolveSongFilePath(song, libraryPath);
    if (!filePath) {
      res.status(403).json({ error: "forbidden", message: "This song's file path is no longer accessible" });
      return;
    }

    try {
      await access(filePath);
    } catch {
      res.status(404).json({ error: "file_not_found", message: "Audio file not found on disk" });
      return;
    }

    const metadata = await parseFile(filePath);
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      res.status(404).json({ error: "no_artwork", message: "No embedded artwork found" });
      return;
    }

    res.setHeader("Content-Type", picture.format);
    res.setHeader("Content-Length", picture.data.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(picture.data);
  } catch (err) {
    next(err);
  }
});

export default router;
