import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Button } from "../../components/common/Button";
import { useToast } from "../../contexts/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import { getSongs, searchSongs } from "../../api/songs";
import { updateSong, triggerMusicScan, getVenue } from "../../api/admin";
import type { Song, MusicSource } from "@playplay/shared";

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
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const debouncedQuery = useDebounce(query, 300);
  const [musicSource, setMusicSource] = useState<MusicSource>("local");
  const [blockConfirm, setBlockConfirm] = useState<Song | null>(null);

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

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await triggerMusicScan();
      showToast(
        `Scan complete: ${result.added} added, ${result.updated} updated, ${result.removed} removed`,
        "success",
      );
      fetchSongs(1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed", "error");
    } finally {
      setScanning(false);
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
      <div className="flex flex-col">
        <AdminPageHeader title="Music Library">
          {musicSource === "local" && (
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? "Scanning..." : "Scan Library"}
            </Button>
          )}
        </AdminPageHeader>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs..."
              className="w-full min-h-12 h-full border-b border-t border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
            />
          </div>
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
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <p className="text-on-surface-muted">
              {query ? "No songs match your search" : "No songs in library"}
            </p>
          </div>
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
                      <p className="truncate text-sm font-semibold font-family-accent">
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
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
