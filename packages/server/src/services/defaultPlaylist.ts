import { basename, extname, isAbsolute, resolve } from "node:path";
import { parseFile } from "music-metadata";
import { prisma } from "../lib/prisma.js";
import { collectAudioFiles, isSupportedAudioExtension } from "./music.js";
import { parseM3uPlaylist } from "./m3u.js";
import { validateLocalPath } from "../lib/paths.js";
import { listPlaylistTracks } from "./spotify.js";
import type {
  DefaultPlaylistConfig,
  DefaultPlaylistRebuildResult,
  LocalDefaultPlaylistSource,
  SpotifyDefaultPlaylistSource,
} from "@playplay/shared";

/** Resolve a configured local-default-playlist path to an absolute path. */
async function resolveLocalSourcePath(
  source: LocalDefaultPlaylistSource,
  libraryRoot: string,
): Promise<string> {
  return validateLocalPath(source.path, {
    baseDir: libraryRoot,
    allowUnc: true,
    allowAbsoluteOutsideBase: true,
    mustExist: true,
    mustBeFile: source.kind === "m3u",
    mustBeDirectory: source.kind === "folder",
  });
}

/**
 * Replace the venue's local fallback-only Songs to match the configured source.
 * Songs that already exist (matched by absolute filePath) are kept; new ones are
 * created; orphans are deleted.
 */
export async function rebuildLocalFallbackPool(
  venueId: string,
  source: LocalDefaultPlaylistSource,
  libraryRoot: string,
): Promise<DefaultPlaylistRebuildResult> {
  const out: DefaultPlaylistRebuildResult = { source: "local", trackCount: 0, errors: [] };

  const root = await resolveLocalSourcePath(source, libraryRoot);

  let absolutePaths: string[];
  try {
    if (source.kind === "folder") {
      absolutePaths = await collectAudioFiles(root);
    } else {
      const entries = await parseM3uPlaylist(root);
      absolutePaths = entries.filter(isSupportedAudioExtension);
    }
  } catch (err) {
    throw new Error(`Failed to read default playlist source: ${(err as Error).message}`);
  }

  // Existing fallback-only local rows for this venue
  const existing = await prisma.song.findMany({
    where: { venueId, source: "local", isFallbackOnly: true },
    select: { id: true, filePath: true },
  });
  const existingByPath = new Map(existing.map((e) => [e.filePath, e] as const));
  const seen = new Set<string>();

  for (const fullPath of absolutePaths) {
    seen.add(fullPath);
    try {
      const metadata = await parseFile(fullPath);
      const title = metadata.common.title || basename(fullPath, extname(fullPath));
      const artist = metadata.common.artist || "Unknown Artist";
      const album = metadata.common.album || "";
      const duration = Math.round(metadata.format.duration || 0);

      const existingRow = existingByPath.get(fullPath);
      if (existingRow) {
        await prisma.song.update({
          where: { id: existingRow.id },
          data: { title, artist, album, duration, blocked: false, isFallbackOnly: true },
        });
      } else {
        await prisma.song.create({
          data: {
            title,
            artist,
            album,
            duration,
            filePath: fullPath,
            venueId,
            source: "local",
            isFallbackOnly: true,
          },
        });
      }
      out.trackCount++;
    } catch (err) {
      out.errors.push(`${fullPath}: ${(err as Error).message}`);
    }
  }

  // Remove rows no longer in the source
  const orphans = existing.filter((e) => e.filePath && !seen.has(e.filePath)).map((e) => e.id);
  if (orphans.length > 0) {
    await prisma.song.deleteMany({ where: { id: { in: orphans } } });
  }

  return out;
}

/**
 * Replace the venue's Spotify fallback-only Songs to match the playlist's tracks.
 * Returns a richer result that includes the playlist's metadata so callers can
 * persist it into venue settings.
 */
export async function rebuildSpotifyFallbackPool(
  venueId: string,
  playlistId: string,
): Promise<DefaultPlaylistRebuildResult & { playlistName: string; ownerName: string }> {
  const out = {
    source: "spotify" as const,
    trackCount: 0,
    errors: [] as string[],
    playlistName: "",
    ownerName: "",
  };

  const fetched = await listPlaylistTracks(venueId, playlistId);
  out.playlistName = fetched.name;
  out.ownerName = fetched.ownerName;

  const existing = await prisma.song.findMany({
    where: { venueId, source: "spotify", isFallbackOnly: true },
    select: { id: true, spotifyTrackId: true },
  });
  const existingByTrack = new Map(existing.map((e) => [e.spotifyTrackId, e] as const));
  const seen = new Set<string>();

  for (const track of fetched.tracks) {
    seen.add(track.spotifyTrackId);
    try {
      const existingRow = existingByTrack.get(track.spotifyTrackId);
      if (existingRow) {
        await prisma.song.update({
          where: { id: existingRow.id },
          data: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            spotifyUri: track.spotifyUri,
            artworkUrl: track.artworkUrl,
            previewUrl: track.previewUrl,
            blocked: false,
            isFallbackOnly: true,
          },
        });
      } else {
        // Avoid colliding with a non-fallback song already imported for the queue
        const dup = await prisma.song.findUnique({
          where: { spotifyTrackId_venueId: { spotifyTrackId: track.spotifyTrackId, venueId } },
        });
        if (dup) {
          await prisma.song.update({
            where: { id: dup.id },
            data: { isFallbackOnly: true },
          });
        } else {
          await prisma.song.create({
            data: {
              title: track.title,
              artist: track.artist,
              album: track.album,
              duration: track.duration,
              source: "spotify",
              spotifyTrackId: track.spotifyTrackId,
              spotifyUri: track.spotifyUri,
              artworkUrl: track.artworkUrl,
              previewUrl: track.previewUrl,
              filePath: null,
              venueId,
              isFallbackOnly: true,
            },
          });
        }
      }
      out.trackCount++;
    } catch (err) {
      out.errors.push(`${track.spotifyTrackId}: ${(err as Error).message}`);
    }
  }

  // Remove orphans
  const orphans = existing
    .filter((e) => e.spotifyTrackId && !seen.has(e.spotifyTrackId))
    .map((e) => e.id);
  if (orphans.length > 0) {
    await prisma.song.deleteMany({ where: { id: { in: orphans } } });
  }

  return out;
}

/** Wipe all isFallbackOnly rows for a venue (used when switching to history source). */
export async function clearFallbackPool(venueId: string): Promise<void> {
  await prisma.song.deleteMany({ where: { venueId, isFallbackOnly: true } });
}

/**
 * Apply a new defaultPlaylist configuration: clears or rebuilds the fallback
 * pool as needed. Caller is responsible for persisting the (possibly enriched)
 * config back to venue settings.
 */
export async function applyDefaultPlaylistConfig(
  venueId: string,
  config: DefaultPlaylistConfig,
  libraryRoot: string,
): Promise<DefaultPlaylistConfig> {
  const next: DefaultPlaylistConfig = { ...config };

  if (config.source === "history") {
    await clearFallbackPool(venueId);
    return next;
  }

  if (config.source === "local") {
    if (!config.local || !config.local.path.trim()) {
      throw new Error("Local default playlist requires a path");
    }
    // Wipe any spotify fallback rows from a prior config
    await prisma.song.deleteMany({ where: { venueId, source: "spotify", isFallbackOnly: true } });
    await rebuildLocalFallbackPool(venueId, config.local, libraryRoot);
    return next;
  }

  if (config.source === "spotify") {
    if (!config.spotify || !config.spotify.playlistId) {
      throw new Error("Spotify default playlist requires a playlistId");
    }
    await prisma.song.deleteMany({ where: { venueId, source: "local", isFallbackOnly: true } });
    const res = await rebuildSpotifyFallbackPool(venueId, config.spotify.playlistId);
    next.spotify = {
      playlistId: config.spotify.playlistId,
      playlistName: res.playlistName || config.spotify.playlistName,
      ownerName: res.ownerName || config.spotify.ownerName,
      trackCount: res.trackCount,
      lastSyncedAt: new Date().toISOString(),
    };
    return next;
  }

  return next;
}
