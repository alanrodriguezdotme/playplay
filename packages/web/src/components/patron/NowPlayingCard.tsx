import type { QueueEntry } from "@playplay/shared";
import { VoteButtons } from "./VoteButtons";

interface NowPlayingCardProps {
  entry: QueueEntry | null;
  onVote: (entryId: string, value: 1 | -1 | 0) => void;
}

export function NowPlayingCard({ entry, onVote }: NowPlayingCardProps) {
  if (!entry) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-border bg-surface-alt p-6 text-center">
        <div className="text-3xl">🎵</div>
        <p className="mt-2 text-on-surface-muted">No song playing</p>
        <p className="mt-1 text-sm text-on-surface-muted">
          Add a song to get the party started!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-border bg-surface-alt p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Now Playing
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
          🎵
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-on-surface">
            {entry.song.title}
          </h2>
          <p className="truncate text-sm text-on-surface-muted">
            {entry.song.artist}
          </p>
          {entry.song.album && (
            <p className="truncate text-xs text-on-surface-muted">
              {entry.song.album}
            </p>
          )}
          {entry.addedBy && (
            <p className="mt-1 text-xs text-on-surface-muted">
              Added by{" "}
              <span className="font-medium text-on-surface">
                {entry.addedBy.displayName || "Someone"}
              </span>
            </p>
          )}
        </div>
        <VoteButtons
          voteScore={entry.voteScore}
          currentUserVote={entry.currentUserVote}
          onVote={(value) => onVote(entry.id, value)}
          size="lg"
        />
      </div>
    </div>
  );
}
