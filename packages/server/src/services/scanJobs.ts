import { randomUUID } from "node:crypto";
import { scanMusicLibrary, type ScanProgress } from "./music.js";

export type ScanJobStatus = "running" | "completed" | "failed" | "cancelled";

export interface ScanJob {
  id: string;
  venueId: string;
  status: ScanJobStatus;
  phase: ScanProgress["phase"];
  startedAt: number;
  finishedAt: number | null;
  total: number;
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: string[];
  currentFile?: string;
  errorMessage?: string;
}

interface JobInternal {
  job: ScanJob;
  abort: AbortController;
}

const jobs = new Map<string, JobInternal>();
const activeByVenue = new Map<string, string>();

export function getJob(jobId: string): ScanJob | undefined {
  return jobs.get(jobId)?.job;
}

export function getActiveJobForVenue(venueId: string): ScanJob | undefined {
  const id = activeByVenue.get(venueId);
  if (!id) return undefined;
  const entry = jobs.get(id);
  if (!entry || entry.job.status !== "running") {
    activeByVenue.delete(venueId);
    return undefined;
  }
  return entry.job;
}

export function cancelJob(jobId: string): boolean {
  const entry = jobs.get(jobId);
  if (!entry || entry.job.status !== "running") return false;
  entry.abort.abort();
  return true;
}

export function startScanJob(venueId: string, libraryPath: string): ScanJob {
  const existing = getActiveJobForVenue(venueId);
  if (existing) return existing;

  const abort = new AbortController();
  const job: ScanJob = {
    id: randomUUID(),
    venueId,
    status: "running",
    phase: "discovering",
    startedAt: Date.now(),
    finishedAt: null,
    total: 0,
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    errors: [],
  };
  jobs.set(job.id, { job, abort });
  activeByVenue.set(venueId, job.id);

  // Fire and forget. The job object is mutated in place via the progress callback.
  void (async () => {
    try {
      const result = await scanMusicLibrary(
        venueId,
        libraryPath,
        (p) => {
          job.phase = p.phase;
          job.total = p.total;
          job.processed = p.processed;
          job.added = p.added;
          job.updated = p.updated;
          job.skipped = p.skipped;
          job.removed = p.removed;
          job.errors = p.errors;
          job.currentFile = p.currentFile;
        },
        abort.signal,
      );
      job.status = "completed";
      job.phase = "done";
      job.added = result.added;
      job.updated = result.updated;
      job.skipped = result.skipped;
      job.removed = result.removed;
      job.errors = result.errors;
      job.finishedAt = Date.now();
    } catch (err) {
      if (abort.signal.aborted) {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.errorMessage = err instanceof Error ? err.message : String(err);
      }
      job.finishedAt = Date.now();
    } finally {
      const current = activeByVenue.get(venueId);
      if (current === job.id) activeByVenue.delete(venueId);
      // Retain finished jobs briefly so the UI can fetch the final state.
      setTimeout(() => jobs.delete(job.id), 10 * 60 * 1000).unref?.();
    }
  })();

  return job;
}
