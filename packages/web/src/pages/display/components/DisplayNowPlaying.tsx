import { useState } from "react";
import type { QueueEntry } from "@playplay/shared";
import { getSongArtworkUrl } from "../../../api/songs";

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
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="mb-4 text-md font-bold uppercase tracking-widest text-primary">
        Now Playing
      </p>
      {showFallback ? (
        <div className="mb-6 flex h-44 w-44 items-center justify-center rounded-2xl bg-primary/10 text-6xl lg:h-66 lg:w-66">
          <span className="animate-pulse">🎵</span>
        </div>
      ) : (
        <img
          src={artworkUrl}
          alt={`${entry.song.title} album art`}
          onError={() => setArtworkError(entry.song.id)}
          className="mb-6 h-44 w-44 object-cover shadow-lg lg:h-66 lg:w-66"
        />
      )}
      <h1 className="max-w-full text-4xl font-extrabold text-on-surface lg:text-5xl font-family-accent">
        {entry.song.title}
      </h1>
      <p className="mt-2 max-w-full truncate text-2xl text-on-surface-muted lg:text-3xl">
        {entry.song.artist}
      </p>
      {entry.song.album && (
        <p className="mt-1 max-w-full truncate text-lg text-on-surface-muted">
          {entry.song.album}
        </p>
      )}
      <div className="mt-4 flex items-center gap-1 text-md text-on-surface-subtle uppercase">
        {entry.addedBy && (
          <span>
            Added by{" "}
            <span className="font-semibold text-on-surface">
              {entry.addedBy.avatarEmoji && (
                <span className="mr-1">{entry.addedBy.avatarEmoji}</span>
              )}
              {entry.addedBy.displayName || "Someone"}
            </span>
          </span>
        )}
        <span className="mx-1">•</span>
        <span className="uppercase font-bold tabular-nums text-on-surface-subtle">
          {entry.voteScore > 0 ? "" : "-"}
          {entry.voteScore} VOTES
        </span>
      </div>
    </div>
  );
}
