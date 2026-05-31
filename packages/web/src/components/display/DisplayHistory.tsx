import type { QueueEntry } from "@playplay/shared";
import { timeAgo } from "../../utils/time";
import SectionHeader from "../common/SectionHeader";

interface DisplayHistoryProps {
  entries: QueueEntry[];
}

export function DisplayHistory({ entries }: DisplayHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <SectionHeader title="Recently Played" muted />
      <div className="divide-y divide-border overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="truncate text-md text-on-surface-muted font-family-accent">
                {entry.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-subtle">
                {entry.song.artist} •{" "}
                <span className="uppercase">
                  {entry.playedAt ? timeAgo(entry.playedAt) : "—"}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
