import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { searchSongs, getMusicSource } from "../../api/songs";
import { searchSpotifyCatalog } from "../../api/spotify";
import { useDebounce } from "../../hooks/useDebounce";
import { useQueue } from "../../contexts/QueueContext";
import { SongCard } from "../../components/patron/SongCard";
import type { Song, MusicSource } from "@playplay/shared";

export function SearchView() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [musicSource, setMusicSource] = useState<MusicSource>("local");
  const [allowFullCatalog, setAllowFullCatalog] = useState(false);

  const LIMIT = 10;

  // Fetch music source settings
  useEffect(() => {
    getMusicSource()
      .then((data) => {
        setMusicSource(data.musicSource);
        setAllowFullCatalog(data.allowFullCatalogSearch);
      })
      .catch(() => {});
  }, []);

  const useSpotifySearch = musicSource === "spotify" && allowFullCatalog;

  const doSearch = useCallback(
    async (q: string, p: number, append: boolean) => {
      if (!q.trim()) {
        setResults([]);
        setTotal(0);
        setHasSearched(false);
        return;
      }
      setIsLoading(true);
      try {
        if (useSpotifySearch) {
          // Search Spotify catalog directly
          const offset = (p - 1) * LIMIT;
          const data = await searchSpotifyCatalog(q, LIMIT, offset);
          const songs: Song[] = data.tracks.map((t) => ({
            id: "", // no local ID yet — SongCard will use spotifyTrackId
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration,
            totalPlays: 0,
            totalAdds: 0,
            isBlocked: false,
            source: "spotify" as const,
            spotifyTrackId: t.spotifyTrackId,
            artworkUrl: t.artworkUrl,
            previewUrl: t.previewUrl,
            spotifyUri: t.spotifyUri,
          }));
          setResults((prev) => (append ? [...prev, ...songs] : songs));
          setTotal(data.total);
        } else {
          // Search local library
          const data = await searchSongs(q, p, LIMIT);
          setResults((prev) =>
            append ? [...prev, ...data.songs] : data.songs,
          );
          setTotal(data.total);
        }
        setHasSearched(true);
      } catch {
        // keep existing results on error
      } finally {
        setIsLoading(false);
      }
    },
    [useSpotifySearch],
  );

  // Search when debounced query or music source settings change
  useEffect(() => {
    setPage(1);
    doSearch(debouncedQuery, 1, false);
  }, [debouncedQuery, doSearch]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(debouncedQuery, nextPage, true);
  };

  const hasMore = results.length < total;

  return (
    <div className="flex flex-1 flex-col">
      {/* Search input */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs by title or artist…"
            className="w-full rounded-xl border border-border bg-surface-alt py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {!hasSearched && !isLoading && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="text-3xl">🔍</div>
          <p className="mt-2 text-on-surface-muted">
            Search for songs to add to the queue
          </p>
        </div>
      )}

      {hasSearched && results.length === 0 && !isLoading && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="text-on-surface-muted">
            No results for "{debouncedQuery}"
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="divide-y divide-border">
          {results.map((song, i) => (
            <SongCard key={song.id || song.spotifyTrackId || i} song={song} />
          ))}
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="px-4 py-4">
          <button
            onClick={loadMore}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-on-surface-muted hover:text-on-surface"
          >
            Load More ({results.length} of {total})
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-6 text-center text-sm text-on-surface-muted">
          Searching…
        </div>
      )}
    </div>
  );
}
