import { useEffect, useState } from "react";
import type { SpotifyPlaylistSummary } from "@playplay/shared";
import { listSpotifyPlaylists } from "../../api/spotify";
import { useDebounce } from "../../hooks/useDebounce";

interface Props {
  selectedId: string | null;
  onSelect: (playlist: SpotifyPlaylistSummary) => void;
  disabled?: boolean;
}

export function SpotifyPlaylistPicker({
  selectedId,
  onSelect,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listSpotifyPlaylists(debouncedQuery || undefined)
      .then((res) => {
        if (cancelled) return;
        setPlaylists(res.playlists);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load playlists",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search public playlists, or leave empty for your playlists"
        disabled={disabled}
        className="w-full border border-border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none disabled:opacity-50"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="max-h-72 overflow-y-auto border border-border bg-surface">
        {loading && playlists.length === 0 ? (
          <div className="p-3 text-xs text-on-surface-muted">Loading…</div>
        ) : playlists.length === 0 ? (
          <div className="p-3 text-xs text-on-surface-muted">
            No playlists found.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {playlists.map((p) => {
              const isSelected = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised disabled:opacity-50 ${
                      isSelected ? "bg-surface-raised" : ""
                    }`}
                  >
                    {p.artworkUrl ? (
                      <img
                        src={p.artworkUrl}
                        alt=""
                        className="h-10 w-10 flex-shrink-0 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 bg-border" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-on-surface-muted">
                        {p.ownerName} · {p.trackCount} tracks
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-primary">
                        SELECTED
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
