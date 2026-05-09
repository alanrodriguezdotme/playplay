import { resolve, isAbsolute, normalize, sep } from "node:path";
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

export class PathValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

export interface PathValidationOptions {
  /** Resolve relative paths against this base. */
  baseDir?: string;
  /** Allow `\\server\share\...` (Windows) or `//server/share/...` UNC paths. */
  allowUnc?: boolean;
  /** Allow absolute paths outside `baseDir`. */
  allowAbsoluteOutsideBase?: boolean;
  /** Verify the path exists on disk. */
  mustExist?: boolean;
  /** When `mustExist` is true, require the target to be a file (not a directory). */
  mustBeFile?: boolean;
  /** When `mustExist` is true, require the target to be a directory. */
  mustBeDirectory?: boolean;
}

function isUnc(p: string): boolean {
  // Windows: \\server\share\...   or  //server/share/...
  return /^(\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(p);
}

/**
 * Validate and canonicalize a file-system path supplied by an admin.
 *
 * Returns an absolute, normalized path string. Throws `PathValidationError`
 * with a stable `code` if the input is unsafe or doesn't satisfy the options.
 */
export async function validateLocalPath(
  input: string,
  options: PathValidationOptions = {},
): Promise<string> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new PathValidationError("empty", "Path is required");
  }

  const trimmed = input.trim();
  const unc = isUnc(trimmed);

  if (unc && !options.allowUnc) {
    throw new PathValidationError("unc_not_allowed", "Network paths are not allowed here");
  }

  let canonical: string;

  if (unc) {
    // Preserve UNC prefix; just normalize separators
    canonical = normalize(trimmed);
  } else if (isAbsolute(trimmed)) {
    canonical = resolve(trimmed);
    if (!options.allowAbsoluteOutsideBase && options.baseDir) {
      const base = resolve(options.baseDir);
      if (!canonical.startsWith(base + sep) && canonical !== base) {
        throw new PathValidationError("outside_base", "Absolute path is outside the allowed directory");
      }
    }
  } else {
    if (!options.baseDir) {
      throw new PathValidationError("relative_without_base", "Relative paths require a base directory");
    }
    const base = resolve(options.baseDir);
    canonical = resolve(base, trimmed);
    if (!canonical.startsWith(base + sep) && canonical !== base) {
      throw new PathValidationError("traversal", "Path escapes the allowed directory");
    }
  }

  if (options.mustExist) {
    try {
      await access(canonical, fsConstants.R_OK);
    } catch {
      throw new PathValidationError("not_found", `Path not found or unreadable: ${canonical}`);
    }
    if (options.mustBeFile || options.mustBeDirectory) {
      const s = await stat(canonical);
      if (options.mustBeFile && !s.isFile()) {
        throw new PathValidationError("not_a_file", "Path is not a file");
      }
      if (options.mustBeDirectory && !s.isDirectory()) {
        throw new PathValidationError("not_a_directory", "Path is not a directory");
      }
    }
  }

  return canonical;
}

/**
 * Returns true when `child` is the same as `parent` or nested below it.
 * Both inputs must already be canonical absolute paths.
 */
export function isUnderPath(child: string, parent: string): boolean {
  const c = normalize(child);
  const p = normalize(parent);
  return c === p || c.startsWith(p + sep);
}
