import type { QueueEntry } from "@playplay/shared";

interface DisplayQueueProps {
  queue: QueueEntry[];
}

export function DisplayQueue({ queue }: DisplayQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <p className="text-on-surface-muted">Queue is empty</p>
        <p className="mt-1 text-sm text-on-surface-muted">
          Scan the QR code to add songs!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <h2 className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-muted">
        Up Next ({queue.length})
      </h2>
      <div className="flex-1 divide-y divide-border overflow-y-auto">
        {queue.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-on-surface-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">
                {entry.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {entry.song.artist}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-on-surface-muted">
              {entry.voteScore > 0 ? "+" : ""}
              {entry.voteScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
