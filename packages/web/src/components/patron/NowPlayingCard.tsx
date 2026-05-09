import type { QueueEntry } from "@playplay/shared";
import { VoteButtons } from "./VoteButtons";
import SectionHeader from "../common/SectionHeader";
import { UserBadge } from "../common/UserBadge";
import { SongArtwork } from "../common/SongArtwork";

interface NowPlayingCardProps {
  entry: QueueEntry | null;
  onVote: (entryId: string, value: 1 | -1 | 0) => void;
}

export function NowPlayingCard({ entry, onVote }: NowPlayingCardProps) {
  if (!entry) {
    return (
      <div className="bg-surface-alt p-6 text-center">
        <div className="text-3xl">🎵</div>
        <p className="mt-2 text-on-surface-muted">No song playing</p>
        <p className="mt-1 text-sm text-on-surface-muted">
          Add a song to get the party started!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-alt">
      <SectionHeader
        title="Now Playing"
        subtitle={
          entry.addedBy ? <UserBadge user={entry.addedBy} /> : undefined
        }
      />
      <div className="flex items-center gap-4 p-4 pt-1">
        <SongArtwork
          song={entry.song}
          alt={entry.song.album || entry.song.title}
          className="h-32 w-32 shrink-0"
        />
        <div className="min-w-0 w-full self-stretch h-full flex-1 flex flex-col gap-1 items-start">
          <div className="w-full">
            <h2 className="text-xl text-on-surface leading-tight line-clamp-3 font-family-accent">
              {entry.song.title}
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            <p className="line-clamp-2 text-sm font-semibold text-on-surface-muted">
              {entry.song.artist}
            </p>
            {entry.song.album && (
              <p className="line-clamp-2 text-xs text-on-surface-subtle">
                {entry.song.album}
              </p>
            )}
          </div>
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
