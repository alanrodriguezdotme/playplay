import { readdir, access, stat } from "node:fs/promises";
import { join, extname, basename, resolve } from "node:path";
import { parseFile } from "music-metadata";
import { prisma } from "../lib/prisma.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".ogg",
  ".wav",
]);

const SCAN_CONCURRENCY = 12;

export interface ScanResult {
  added: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: string[];
}

export interface ScanProgress {
  phase: "discovering" | "indexing" | "pruning" | "done";
  total: number;
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: string[];
  currentFile?: string;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

export async function collectAudioFiles(
  dir: string,
  onError?: (path: string, err: Error) => void,
  signal?: AbortSignal
): Promise<string[]> {
  const files: string[] = [];
  if (signal?.aborted) return files;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    onError?.(dir, err as Error);
    return files;
  }

  for (const entry of entries) {
    if (signal?.aborted) return files;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectAudioFiles(fullPath, onError, signal);
      files.push(...nested);
    } else if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

export function isSupportedAudioExtension(p: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(p).toLowerCase());
}

interface ExistingSongRow {
  id: string;
  filePath: string | null;
  fileMtime: bigint | null;
  fileSize: bigint | null;
}

async function indexSingleFile(
  fullPath: string,
  relativePath: string,
  venueId: string,
  existing: ExistingSongRow | undefined,
  result: ScanResult
): Promise<void> {
  let st;
  try {
    st = await stat(fullPath);
  } catch (err) {
    result.errors.push(`${relativePath}: ${(err as Error).message}`);
    return;
  }
  const mtime = BigInt(Math.floor(st.mtimeMs));
  const size = BigInt(st.size);

  // Fast path: file unchanged since last scan -> skip metadata parsing.
  if (
    existing &&
    existing.fileMtime !== null &&
    existing.fileSize !== null &&
    existing.fileMtime === mtime &&
    existing.fileSize === size
  ) {
    result.skipped++;
    return;
  }

  try {
    const metadata = await parseFile(fullPath);
    const common = metadata.common;
    const format = metadata.format;

    const title = common.title || basename(fullPath, extname(fullPath));
    const artist = common.artist || "Unknown Artist";
    const album = common.album || "";
    const duration = Math.round(format.duration || 0);

    if (existing) {
      await prisma.song.update({
        where: { id: existing.id },
        data: {
          title,
          artist,
          album,
          duration,
          blocked: false,
          fileMtime: mtime,
          fileSize: size,
        },
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
          fileMtime: mtime,
          fileSize: size,
          venueId,
        },
      });
      result.added++;
    }
  } catch (err) {
    result.errors.push(`${relativePath}: ${(err as Error).message}`);
  }
}

export async function scanMusicLibrary(
  venueId: string,
  libraryPath: string,
  onProgress?: ScanProgressCallback,
  signal?: AbortSignal
): Promise<ScanResult> {
  const resolvedPath = resolve(libraryPath);
  // resolve() strips trailing separators on local paths, but UNC paths bypass
  // resolve() (handled in getLibraryRoot) and may retain a trailing slash. Use
  // the actual prefix length so we don't trim a leading character off relpaths.
  const prefixLen =
    resolvedPath.endsWith("\\") || resolvedPath.endsWith("/")
      ? resolvedPath.length
      : resolvedPath.length + 1;
  const result: ScanResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    errors: [],
  };

  const throwIfAborted = () => {
    if (signal?.aborted) throw new Error("Scan cancelled");
  };

  const emit = (phase: ScanProgress["phase"], extra?: Partial<ScanProgress>) => {
    onProgress?.({
      phase,
      total: extra?.total ?? 0,
      processed: extra?.processed ?? 0,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      removed: result.removed,
      errors: result.errors,
      currentFile: extra?.currentFile,
    });
  };

  emit("discovering");

  // Collect all audio files (errors per-folder are recorded, not fatal).
  let audioFiles: string[];
  try {
    audioFiles = await collectAudioFiles(
      resolvedPath,
      (path, err) => {
        const rel = path.startsWith(resolvedPath)
          ? path.slice(prefixLen) || "."
          : path;
        result.errors.push(`${rel}: ${err.message}`);
      },
      signal,
    );
  } catch (err) {
    throw new Error(
      `Cannot read music library at ${resolvedPath}: ${(err as Error).message}`
    );
  }
  throwIfAborted();

  // Preload existing rows once so we don't hit the DB per file.
  const existingRows = await prisma.song.findMany({
    where: { venueId, source: "local", isFallbackOnly: false },
    select: { id: true, filePath: true, fileMtime: true, fileSize: true },
  });
  const existingByPath = new Map<string, ExistingSongRow>();
  for (const row of existingRows) {
    if (row.filePath) existingByPath.set(row.filePath, row);
  }

  const total = audioFiles.length;
  let processed = 0;
  const foundPaths = new Set<string>();

  emit("indexing", { total, processed });

  // Worker-pool concurrency.
  let cursor = 0;
  const worker = async () => {
    while (true) {
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= audioFiles.length) return;
      const fullPath = audioFiles[i];
      const relativePath = fullPath.slice(prefixLen);
      foundPaths.add(relativePath);
      await indexSingleFile(
        fullPath,
        relativePath,
        venueId,
        existingByPath.get(relativePath),
        result
      );
      processed++;
      // Throttle progress emissions to ~every 25 files to avoid flooding.
      if (processed % 25 === 0 || processed === total) {
        emit("indexing", { total, processed, currentFile: relativePath });
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(SCAN_CONCURRENCY, Math.max(1, total)) },
    () => worker()
  );
  await Promise.all(workers);

  throwIfAborted();

  emit("pruning", { total, processed });

  // Mark songs whose files no longer exist on disk.
  for (const row of existingRows) {
    if (signal?.aborted) throwIfAborted();
    if (!row.filePath) continue;
    if (foundPaths.has(row.filePath)) continue;
    const absolutePath = join(resolvedPath, row.filePath);
    try {
      await access(absolutePath);
    } catch {
      await prisma.song.update({
        where: { id: row.id },
        data: { blocked: true },
      });
      result.removed++;
    }
  }

  emit("done", { total, processed });

  return result;
}
