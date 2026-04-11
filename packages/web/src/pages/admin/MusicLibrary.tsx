import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import { getSongs, searchSongs } from "../../api/songs";
import { updateSong, triggerMusicScan, getVenue } from "../../api/admin";
import { searchSpotifyCatalog, importSpotifyTrack } from "../../api/spotify";
import type { Song, SpotifyTrack, MusicSource } from "@playplay/shared";

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
  const [tab, setTab] = useState<"library" | "spotify-import">("library");

  // Spotify import state
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const debouncedSpotifyQuery = useDebounce(spotifyQuery, 300);
  const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([]);
  const [spotifyTotal, setSpotifyTotal] = useState(0);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // Fetch venue settings to know the music source
  useEffect(() => {
    getVenue()
      .then((v) => setMusicSource(v.settings.musicSource))
      .catch(() => { });
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
    }
  };

  const filteredSongs = songs.filter((s) => {
    if (filter === "active") return !s.isBlocked;
    if (filter === "blocked") return s.isBlocked;
    return true;
  });

  // Spotify catalog search
  useEffect(() => {
    if (!debouncedSpotifyQuery) {
      setSpotifyResults([]);
      setSpotifyTotal(0);
      return;
    }
    setSpotifyLoading(true);
    searchSpotifyCatalog(debouncedSpotifyQuery, 20)
      .then((data) => {
        setSpotifyResults(data.tracks);
        setSpotifyTotal(data.total);
      })
      .catch(() => showToast("Spotify search failed", "error"))
      .finally(() => setSpotifyLoading(false));
  }, [debouncedSpotifyQuery, showToast]);

  const handleImport = async (track: SpotifyTrack) => {
    setImportingIds((prev) => new Set(prev).add(track.spotifyTrackId));
    try {
      await importSpotifyTrack(track.spotifyTrackId);
      showToast(`Added "${track.title}" to library`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Import failed",
        "error",
      );
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(track.spotifyTrackId);
        return next;
      });
    }
  };

  const showSpotifyTab = musicSource === "spotify";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Music Library</h2>
        {tab === "library" && (
          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Scan Library"}
          </button>
        )}
      </div>

      {/* Tabs */}
      {showSpotifyTab && (
        <div className="flex rounded-lg border border-border">
          <button
            onClick={() => setTab("library")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-l-lg ${tab === "library"
                ? "bg-primary text-on-primary"
                : "text-on-surface-muted hover:text-on-surface"
              }`}
          >
            Library
          </button>
          <button
            onClick={() => setTab("spotify-import")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-r-lg ${tab === "spotify-import"
                ? "bg-primary text-on-primary"
                : "text-on-surface-muted hover:text-on-surface"
              }`}
          >
            Import from Spotify
          </button>
        </div>
      )}

      {tab === "spotify-import" && showSpotifyTab ? (
        /* Spotify Import Tab */
        <div className="space-y-4">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={spotifyQuery}
              onChange={(e) => setSpotifyQuery(e.target.value)}
              placeholder="Search Spotify catalog..."
              className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
            />
          </div>

          {spotifyLoading ? (
            <div className="flex items-center justify-center p-12">
              <p className="text-on-surface-muted">Searching Spotify...</p>
            </div>
          ) : spotifyResults.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
              <p className="text-on-surface-muted">
                {spotifyQuery
                  ? "No results found"
                  : "Search the Spotify catalog to add songs to your library"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {spotifyResults.map((track) => (
                <div
                  key={track.spotifyTrackId}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
                >
                  {track.artworkUrl && (
                    <img
                      src={track.artworkUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-on-surface-muted">
                      {track.artist}
                      {track.album && <span> · {track.album}</span>}
                    </p>
                  </div>
                  <span className="hidden md:block text-xs text-on-surface-muted">
                    {formatDuration(track.duration)}
                  </span>
                  <button
                    onClick={() => handleImport(track)}
                    disabled={importingIds.has(track.spotifyTrackId)}
                    className="rounded-lg bg-[#1DB954] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1ed760] disabled:opacity-50 shrink-0"
                  >
                    {importingIds.has(track.spotifyTrackId)
                      ? "Adding..."
                      : "Add to Library"}
                  </button>
                </div>
              ))}
              {spotifyResults.length < spotifyTotal && (
                <p className="text-center text-xs text-on-surface-muted py-2">
                  Showing {spotifyResults.length} of {spotifyTotal} results
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Library Tab (original content) */
        <>
          {/* Search + Filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs..."
                className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
              />
            </div>
            <div className="flex rounded-lg border border-border">
              {(["all", "active", "blocked"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg ${filter === f
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-muted hover:text-on-surface"
                    }`}
                >
                  {f}
                </button>
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
              <div className="hidden md:flex items-center gap-3 px-3 py-2 text-xs font-medium text-on-surface-muted uppercase tracking-wider">
                <span className="flex-1">Song</span>
                <span className="w-20 text-right">Duration</span>
                <span className="w-16 text-right">Plays</span>
                <span className="w-20 text-center">Status</span>
                <span className="w-20 text-center">Action</span>
              </div>

              <div className="space-y-1">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 ${song.isBlocked ? "bg-surface opacity-60" : "bg-surface-raised"
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{song.title}</p>
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
                    <span className="w-20 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${song.isBlocked
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
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${song.isBlocked
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
        </>
      )}
    </div>
  );
}
