import { useState, useEffect, useCallback } from "react";
import type { QueueEntry } from "@playplay/shared";
import { getQueueHistory } from "../../api/queue";
import { timeAgo } from "../../utils/time";
import { Button } from "../../components/common/Button";
import { UserBadge } from "../../components/common/UserBadge";

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
        {entries.map((entry) => {
          const isFallback = entry.addedBy === null;
          return (
            <div key={entry.id} className="flex items-center gap-4 px-4 py-4">
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <p className="truncate text-md text-on-surface font-family-accent">
                  {entry.song.title}
                </p>
                <p className="truncate text-sm text-on-surface-muted">
                  {entry.song.artist}
                </p>
                <div className="flex gap-1 mt-0.5 text-xs text-on-surface-subtle">
                  {entry.addedBy ? (
                    <UserBadge user={entry.addedBy} />
                  ) : (
                    <span className="uppercase text-on-surface-subtle">
                      Auto-played
                    </span>
                  )}
                  <p>•</p>
                  <p className="uppercase">
                    {entry.playedAt ? timeAgo(entry.playedAt) : "—"}
                  </p>
                </div>
              </div>
              {!isFallback && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xl tabular-nums text-primary font-family-accent">
                    {entry.voteScore}
                  </div>
                  <div className="text-xs uppercase font-semibold text-on-surface-muted">
                    votes
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && !isLoading && (
        <div className="px-4 py-4">
          <Button variant="secondary" fullWidth onClick={loadMore}>
            Load More ({entries.length} of {total})
          </Button>
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
