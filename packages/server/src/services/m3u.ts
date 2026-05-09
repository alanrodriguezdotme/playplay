import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Parse an `.m3u` / `.m3u8` playlist and return the list of referenced
 * audio file paths, resolved to absolute paths.
 *
 * - Lines beginning with `#` (extension directives like `#EXTM3U`, `#EXTINF`) are skipped
 * - Blank lines are skipped
 * - HTTP(S) URLs are skipped (we only handle local fallback files)
 * - Relative entries are resolved against the playlist file's directory
 * - Windows-style backslashes are normalized
 */
export async function parseM3uPlaylist(m3uPath: string): Promise<string[]> {
  const baseDir = dirname(m3uPath);
  const raw = await readFile(m3uPath, "utf8");
  // Strip BOM if present
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (/^[a-z]+:\/\//i.test(trimmed)) continue; // skip URLs

    const path = isAbsolute(trimmed) ? trimmed : resolve(baseDir, trimmed);
    out.push(path);
  }

  return out;
}
