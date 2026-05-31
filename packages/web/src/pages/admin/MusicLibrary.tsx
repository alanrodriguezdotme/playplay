import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { SearchInput } from "../../components/common/SearchInput";
import { useToast } from "../../contexts/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import { getSongs, searchSongs } from "../../api/songs";
import {
  updateSong,
  triggerMusicScan,
  getActiveMusicScan,
  getMusicScanJob,
  cancelMusicScan,
  clearMusicLibrary,
  getVenue,
} from "../../api/admin";
import type { Song, MusicSource, ScanJob } from "@playplay/shared";

type Filter = "all" | "active" | "blocked";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicLibrary() {
  const { showToast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scanJob, setScanJob] = useState<ScanJob | null>(null);
  const scanning = scanJob?.status === "running";
  const pollRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const debouncedQuery = useDebounce(query, 300);
  const [musicSource, setMusicSource] = useState<MusicSource>("local");
  const [blockConfirm, setBlockConfirm] = useState<Song | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Fetch venue settings to know the music source
  useEffect(() => {
    getVenue()
      .then((v) => setMusicSource(v.settings.musicSource))
      .catch(() => {});
  }, []);

  const fetchSongs = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      try {
        if (debouncedQuery) {
          const data = await searchSongs(debouncedQuery, p, 50);
          setSongs((prev) => (append ? [...prev, ...data.songs] : data.songs));
          setTotal(data.total);
        } else {
          const data = await getSongs(p, 50);
          setSongs((prev) => (append ? [...prev, ...data.songs] : data.songs));
          setTotal(data.total);
        }
        setPage(p);
      } catch {
        showToast("Failed to load songs", "error");
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, showToast],
  );

  useEffect(() => {
    fetchSongs(1);
  }, [fetchSongs]);

  // Attach to an in-progress scan on mount.
  useEffect(() => {
    getActiveMusicScan()
      .then((job) => {
        if (job) setScanJob(job);
      })
      .catch(() => {});
  }, []);

  // Poll the active job until it finishes.
  useEffect(() => {
    if (!scanJob || scanJob.status !== "running") {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const id = window.setInterval(async () => {
      try {
        const next = await getMusicScanJob(scanJob.id);
        setScanJob(next);
        if (next.status !== "running") {
          if (next.status === "completed") {
            showToast(
              `Scan complete: ${next.added} added, ${next.updated} updated, ${next.skipped} unchanged, ${next.removed} removed${next.errors.length ? `, ${next.errors.length} errors` : ""}`,
              "success",
            );
            fetchSongs(1);
          } else if (next.status === "cancelled") {
            showToast("Scan cancelled");
            fetchSongs(1);
          } else if (next.status === "failed") {
            showToast(next.errorMessage ?? "Scan failed", "error");
          }
        }
      } catch {
        // transient error — keep polling
      }
    }, 1000);
    pollRef.current = id;
    return () => {
      window.clearInterval(id);
      pollRef.current = null;
    };
  }, [scanJob?.id, scanJob?.status, fetchSongs, showToast]);

  const handleScan = async () => {
    try {
      const job = await triggerMusicScan();
      setScanJob(job);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed", "error");
    }
  };

  const handleCancelScan = async () => {
    if (!scanJob) return;
    try {
      const job = await cancelMusicScan(scanJob.id);
      setScanJob(job);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to cancel scan",
        "error",
      );
    }
  };

  const handleClearLibrary = async () => {
    setClearing(true);
    try {
      const res = await clearMusicLibrary();
      showToast(
        `Cleared ${res.deletedSongs.toLocaleString()} songs`,
        "success",
      );
      setClearConfirmOpen(false);
      await fetchSongs(1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to clear library",
        "error",
      );
    } finally {
      setClearing(false);
    }
  };

  const handleToggleBlock = async (song: Song) => {
    // Blocking requires confirmation; unblocking does not
    if (!song.isBlocked) {
      setBlockConfirm(song);
      return;
    }
    await executeToggleBlock(song);
  };

  const executeToggleBlock = async (song: Song) => {
    try {
      const updated = await updateSong(song.id, { blocked: !song.isBlocked });
      setSongs((prev) =>
        prev.map((s) =>
          s.id === song.id ? { ...s, isBlocked: updated.blocked } : s,
        ),
      );
      showToast(
        updated.blocked
          ? `Blocked "${song.title}"`
          : `Unblocked "${song.title}"`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update song",
        "error",
      );
    } finally {
      setBlockConfirm(null);
    }
  };

  const filteredSongs = songs.filter((s) => {
    if (filter === "active") return !s.isBlocked;
    if (filter === "blocked") return s.isBlocked;
    return true;
  });

  return (
    <>
      <ConfirmDialog
        open={!!blockConfirm}
        title="Block Song"
        message={`Are you sure you want to block "${blockConfirm?.title}" by ${blockConfirm?.artist}? It will no longer be available for patrons to add.`}
        confirmLabel="Block"
        variant="destructive"
        onConfirm={() => blockConfirm && executeToggleBlock(blockConfirm)}
        onCancel={() => setBlockConfirm(null)}
      />
      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear Music Library"
        message={`Delete all ${total.toLocaleString()} local songs and their queue history? This cannot be undone.`}
        confirmLabel={clearing ? "Clearing…" : "Clear"}
        variant="destructive"
        onConfirm={handleClearLibrary}
        onCancel={() => !clearing && setClearConfirmOpen(false)}
      />
      <div className="flex flex-col">
        <AdminPageHeader title="Music Library">
          {musicSource === "local" &&
            (scanning ? (
              <Button variant="ghost" size="sm" onClick={handleCancelScan}>
                Stop Scan
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearConfirmOpen(true)}
                  disabled={clearing}
                >
                  Clear Library
                </Button>
                <Button variant="secondary" size="sm" onClick={handleScan}>
                  Scan Library
                </Button>
              </div>
            ))}
        </AdminPageHeader>

        {scanJob && <ScanProgressBanner job={scanJob} />}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search songs..."
            wrapperClassName="flex-1"
          />
          <div className="flex border-b sm:border border-border">
            {(["all", "active", "blocked"] as Filter[]).map((f) => (
              <Button
                key={f}
                variant="ghost"
                rounded="none"
                active={filter === f}
                onClick={() => setFilter(f)}
                className="p-4 capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Song list */}
        {loading && songs.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-on-surface-muted">Loading songs...</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-on-surface-muted">
              {query ? "No songs match your search" : "No songs in library"}
            </p>
          </Card>
        ) : (
          <>
            {/* Table header - desktop */}
            <div className="hidden md:flex items-center gap-3 p-4 text-xs font-medium text-on-surface-muted uppercase tracking-wider">
              <span className="flex-1">Song</span>
              <span className="w-20 text-right">Duration</span>
              <span className="w-16 text-right">Plays</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-20 text-center">Action</span>
            </div>

            <div className="flex flex-col divide-y divide-border">
              {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className={`flex items-center gap-2 p-4 ${
                    song.isBlocked ? "bg-surface opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex gap-2">
                      <p className="truncate text-sm font-family-accent">
                        {song.title}
                      </p>
                      <span
                        className={`md:hidden inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          song.isBlocked
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {song.isBlocked ? "blocked" : "active"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-on-surface-muted">
                      {song.artist}
                      {song.album && <span> · {song.album}</span>}
                    </p>
                  </div>
                  <span className="hidden md:block w-20 text-right text-xs text-on-surface-muted">
                    {formatDuration(song.duration)}
                  </span>
                  <span className="hidden md:block w-16 text-right text-xs text-on-surface-muted">
                    {song.totalPlays}
                  </span>
                  <span className="w-20 text-center hidden md:block">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        song.isBlocked
                          ? "bg-destructive/15 text-destructive"
                          : "bg-success/15 text-success"
                      }`}
                    >
                      {song.isBlocked ? "blocked" : "active"}
                    </span>
                  </span>
                  <span className="w-20 text-center">
                    <button
                      onClick={() => handleToggleBlock(song)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        song.isBlocked
                          ? "border border-success/30 text-success hover:bg-success/15"
                          : "border border-destructive/30 text-destructive hover:bg-destructive/15"
                      }`}
                    >
                      {song.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {songs.length < total && (
              <button
                onClick={() => fetchSongs(page + 1, true)}
                disabled={loading}
                className="w-full rounded-lg border border-border py-2.5 text-xs font-medium text-on-surface-muted hover:text-on-surface disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : `Load More (${songs.length} of ${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ScanProgressBanner({ job }: { job: ScanJob }) {
  const pct =
    job.total > 0
      ? Math.min(100, Math.round((job.processed / job.total) * 100))
      : 0;

  const phaseLabel: Record<ScanJob["phase"], string> = {
    discovering: "Scanning folders…",
    indexing: "Reading metadata…",
    pruning: "Cleaning up…",
    done: "Done",
  };

  const tone =
    job.status === "failed"
      ? "border-error/40 bg-error/10"
      : job.status === "cancelled"
        ? "border-border bg-surface-raised"
        : job.status === "completed"
          ? "border-success/40 bg-success/10"
          : "border-border bg-surface-raised";

  const headline =
    job.status === "running"
      ? phaseLabel[job.phase]
      : job.status === "completed"
        ? "Scan complete"
        : job.status === "cancelled"
          ? "Scan cancelled"
          : "Scan failed";

  return (
    <div className={`border ${tone} p-4 text-xs text-on-surface`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{headline}</span>
        <span className="text-on-surface-muted tabular-nums">
          {job.phase === "indexing" || job.status !== "running"
            ? `${job.processed.toLocaleString()} / ${job.total.toLocaleString()}`
            : ""}
        </span>
      </div>
      {job.status === "running" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: job.phase === "discovering" ? "100%" : `${pct}%`,
              opacity: job.phase === "discovering" ? 0.4 : 1,
            }}
          />
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-on-surface-muted tabular-nums">
        <span>added {job.added.toLocaleString()}</span>
        <span>updated {job.updated.toLocaleString()}</span>
        <span>unchanged {job.skipped.toLocaleString()}</span>
        <span>removed {job.removed.toLocaleString()}</span>
        {job.errors.length > 0 && (
          <span className="text-error">errors {job.errors.length}</span>
        )}
      </div>
      {job.status === "running" && job.currentFile && (
        <p
          className="mt-1 truncate text-on-surface-muted"
          title={job.currentFile}
        >
          {job.currentFile}
        </p>
      )}
      {job.status === "failed" && job.errorMessage && (
        <p className="mt-1 text-error">{job.errorMessage}</p>
      )}
    </div>
  );
}
