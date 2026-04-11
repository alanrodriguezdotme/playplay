import { readdir, stat, access } from "node:fs/promises";
import { join, extname, basename, resolve } from "node:path";
import { parseFile } from "music-metadata";
import { prisma, parseSettings } from "../lib/prisma.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".ogg",
  ".wav",
]);

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

async function collectAudioFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectAudioFiles(fullPath);
      files.push(...nested);
    } else if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function scanMusicLibrary(
  venueId: string,
  libraryPath: string
): Promise<ScanResult> {
  const resolvedPath = resolve(libraryPath);
  const result: ScanResult = { added: 0, updated: 0, removed: 0, errors: [] };

  // Get venue settings for default playlist path
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  const settings = venue ? parseSettings(venue.settings) : undefined;
  const defaultPlaylistPath = (settings?.defaultPlaylistPath as string) || "";

  // Collect all audio files
  let audioFiles: string[];
  try {
    audioFiles = await collectAudioFiles(resolvedPath);
  } catch (err) {
    throw new Error(
      `Cannot read music library at ${resolvedPath}: ${(err as Error).message}`
    );
  }

  // Track which relative paths we found on disk
  const foundPaths = new Set<string>();

  for (const fullPath of audioFiles) {
    const relativePath = fullPath.slice(resolvedPath.length + 1); // strip leading dir + separator
    foundPaths.add(relativePath);

    try {
      const metadata = await parseFile(fullPath);
      const common = metadata.common;
      const format = metadata.format;

      const title =
        common.title || basename(fullPath, extname(fullPath));
      const artist = common.artist || "Unknown Artist";
      const album = common.album || "";
      const duration = Math.round(format.duration || 0);
      const isDefault = defaultPlaylistPath
        ? relativePath.startsWith(defaultPlaylistPath)
        : false;

      const existing = await prisma.song.findUnique({
        where: { filePath_venueId: { filePath: relativePath, venueId } },
      });

      if (existing) {
        await prisma.song.update({
          where: { id: existing.id },
          data: { title, artist, album, duration, blocked: false, isDefault },
        });
        result.updated++;
      } else {
        await prisma.song.create({
          data: {
            title,
            artist,
            album,
            duration,
            filePath: relativePath,
            venueId,
            isDefault,
          },
        });
        result.added++;
      }
    } catch (err) {
      result.errors.push(`${relativePath}: ${(err as Error).message}`);
    }
  }

  // Mark songs whose files no longer exist on disk (local songs only)
  const existingSongs = await prisma.song.findMany({
    where: { venueId, blocked: false, source: "local" },
    select: { id: true, filePath: true },
  });

  for (const song of existingSongs) {
    if (!song.filePath || !foundPaths.has(song.filePath)) {
      if (!song.filePath) continue; // Spotify songs don't have file paths
      // Verify the file really doesn't exist (it might have been added via seed with a different path)
      const absolutePath = join(resolvedPath, song.filePath);
      try {
        await access(absolutePath);
      } catch {
        await prisma.song.update({
          where: { id: song.id },
          data: { blocked: true },
        });
        result.removed++;
      }
    }
  }

  return result;
}
