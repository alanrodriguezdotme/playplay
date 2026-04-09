import { useState, useEffect, useCallback } from "react";
import type { QueueEntry } from "@playplay/shared";
import { getQueueHistory } from "../../api/queue";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HistoryView() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const LIMIT = 20;

  const fetchHistory = useCallback(async (p: number, append: boolean) => {
    setIsLoading(true);
    try {
      const data = await getQueueHistory(p, LIMIT);
      setEntries((prev) =>
        append ? [...prev, ...data.entries] : data.entries,
      );
      setTotal(data.total);
    } catch {
      // keep existing entries on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1, false);
  }, [fetchHistory]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, true);
  };

  const hasMore = entries.length < total;

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-on-surface-muted">Loading history…</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="text-3xl">📜</div>
        <p className="mt-2 text-on-surface-muted">No songs played yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="divide-y divide-border">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">
                {entry.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {entry.song.artist}
              </p>
              {entry.addedBy && (
                <p className="mt-0.5 text-xs text-on-surface-muted">
                  {entry.addedBy.displayName || "Someone"}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs tabular-nums text-on-surface-muted">
                {entry.playedAt ? timeAgo(entry.playedAt) : "—"}
              </p>
              <p className="text-xs tabular-nums text-on-surface-muted">
                {entry.voteScore > 0 ? "+" : ""}
                {entry.voteScore} votes
              </p>
            </div>
          </div>
        ))}
      </div>

      {hasMore && !isLoading && (
        <div className="px-4 py-4">
          <button
            onClick={loadMore}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-on-surface-muted hover:text-on-surface"
          >
            Load More ({entries.length} of {total})
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-6 text-center text-sm text-on-surface-muted">
          Loading…
        </div>
      )}
    </div>
  );
}
