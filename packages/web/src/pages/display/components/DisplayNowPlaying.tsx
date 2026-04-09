import type { QueueEntry } from "@playplay/shared";

interface DisplayNowPlayingProps {
  entry: QueueEntry | null;
}

export function DisplayNowPlaying({ entry }: DisplayNowPlayingProps) {
  if (!entry) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl">🎵</div>
        <p className="mt-4 text-2xl font-semibold text-on-surface-muted">
          No song playing
        </p>
        <p className="mt-2 text-lg text-on-surface-muted">
          Scan the QR code to add a song!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="mb-4 text-sm font-bold uppercase tracking-widest text-primary">
        Now Playing
      </p>
      <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-2xl bg-primary/10 text-5xl">
        <span className="animate-pulse">🎵</span>
      </div>
      <h1 className="max-w-full truncate text-4xl font-extrabold text-on-surface lg:text-5xl">
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
      <div className="mt-4 flex items-center gap-4 text-lg text-on-surface-muted">
        {entry.addedBy && (
          <span>
            Added by{" "}
            <span className="font-semibold text-on-surface">
              {entry.addedBy.displayName || "Someone"}
            </span>
          </span>
        )}
        <span className="rounded-full bg-surface-raised px-3 py-1 font-bold tabular-nums text-on-surface">
          {entry.voteScore > 0 ? "+" : ""}
          {entry.voteScore}
        </span>
      </div>
    </div>
  );
}
