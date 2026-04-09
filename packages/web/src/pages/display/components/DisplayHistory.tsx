import type { QueueEntry } from "@playplay/shared";
import { timeAgo } from "../../../utils/time";

interface DisplayHistoryProps {
  entries: QueueEntry[];
}

export function DisplayHistory({ entries }: DisplayHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <h2 className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-muted">
        Recently Played
      </h2>
      <div className="divide-y divide-border overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">
                {entry.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {entry.song.artist}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-on-surface-muted">
              {entry.playedAt ? timeAgo(entry.playedAt) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
