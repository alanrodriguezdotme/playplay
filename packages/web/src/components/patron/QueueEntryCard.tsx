import type { QueueEntry } from "@playplay/shared";
import { useAuth } from "../../contexts/AuthContext";
import { VoteButtons } from "./VoteButtons";

interface QueueEntryCardProps {
  entry: QueueEntry;
  position: number;
  onVote: (entryId: string, value: 1 | -1 | 0) => void;
}

export function QueueEntryCard({
  entry,
  position,
  onVote,
}: QueueEntryCardProps) {
  const { user } = useAuth();
  const isOwnEntry = user && entry.addedBy?.id === user.id;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* <span className="w-6 shrink-0 text-center text-sm font-medium text-on-surface-muted">
        {position}
      </span> */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">
          {entry.song.title}
        </p>
        <p className="truncate text-xs text-on-surface-muted">
          {entry.song.artist}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isOwnEntry ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              You
            </span>
          ) : entry.addedBy ? (
            <span className="text-xs text-on-surface-muted">
              {entry.addedBy.displayName || "Someone"}
            </span>
          ) : null}
        </div>
      </div>
      <VoteButtons
        voteScore={entry.voteScore}
        currentUserVote={entry.currentUserVote}
        onVote={(value) => onVote(entry.id, value)}
        size="sm"
      />
    </div>
  );
}
