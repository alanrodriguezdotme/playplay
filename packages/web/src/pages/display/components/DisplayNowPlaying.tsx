import { useState } from "react";
import type { QueueEntry } from "@playplay/shared";
import { getSongArtworkUrl } from "../../../api/songs";
import { UserBadge } from "../../../components/common/UserBadge";

interface DisplayNowPlayingProps {
  entry: QueueEntry | null;
}

export function DisplayNowPlaying({ entry }: DisplayNowPlayingProps) {
  const [artworkError, setArtworkError] = useState<string | null>(null);

  if (!entry) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl">🎵</div>
        <p className="mt-4 text-2xl font-semibold text-on-surface-muted font-family-accent">
          No song playing
        </p>
        <p className="mt-2 text-lg text-on-surface-muted">
          Scan the QR code to add a song!
        </p>
      </div>
    );
  }

  const artworkUrl =
    entry.song.source === "spotify" && entry.song.artworkUrl
      ? entry.song.artworkUrl
      : getSongArtworkUrl(entry.song.id);
  const showFallback = artworkError === entry.song.id;

  return (
    <div className="flex flex-1 landscape:flex-col landscape:items-center landscape:justify-center gap-4 shrink-0 h-50 lg:h-66 w-full landscape:h-full">
      <p className="hidden landscape:block mb-4 text-md font-bold uppercase tracking-widest text-primary">
        Now Playing
      </p>
      {showFallback ? (
        <div className="mb-6 flex h-50 w-50 items-center justify-center rounded-2xl bg-primary/10 text-6xl lg:h-66 lg:w-66">
          <span className="animate-pulse">🎵</span>
        </div>
      ) : (
        <img
          src={artworkUrl}
          alt={`${entry.song.title} album art`}
          onError={() => setArtworkError(entry.song.id)}
          className="mb-6 h-50 w-50 shrink-0 object-cover shadow-lg lg:h-66 lg:w-66"
        />
      )}
      <div className="flex portrait:flex-1 flex-col gap-1 landscape:gap-2 px-4 min-w-0 landscape:w-full landscape:text-center landscape:items-center landscape:justify-center">
        <p className="landscape:hidden text-md font-bold uppercase tracking-wide text-primary">
          Now Playing
        </p>
        <h1 className="mt-auto max-w-full w-full text-3xl font-extrabold text-on-surface lg:text-5xl font-family-accent line-clamp-3 pb-2">
          {entry.song.title}
        </h1>
        <p className="max-w-full text-lg text-on-surface-muted line-clamp-2">
          {entry.song.artist} {entry.song.album && `• ${entry.song.album}`}
        </p>
        <div className="flex items-center gap-1 text-sm font-semibold uppercase">
          {entry.addedBy && (
            <UserBadge
              user={entry.addedBy}
              className="text-on-surface text-on-surface-subtle"
            />
          )}
          <span className="mx-1">•</span>
          <span className="uppercase font-bold tabular-nums text-on-surface-subtle">
            {entry.voteScore} VOTES
          </span>
        </div>
      </div>
    </div>
  );
}
