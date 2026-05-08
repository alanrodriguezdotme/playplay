import { useState } from "react";
import type { QueueEntry, Song } from "@playplay/shared";
import { getSongArtworkUrl } from "../../../api/songs";
import SectionHeader from "../../../components/common/SectionHeader";

function QueueItemArt({ song }: { song: Song }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-base">
        🎵
      </div>
    );
  }

  const url =
    song.source === "spotify" && song.artworkUrl
      ? song.artworkUrl
      : getSongArtworkUrl(song.id);

  return (
    <img
      src={url}
      alt=""
      className="h-9 w-9 shrink-0 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

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
    <div className="flex flex-col overflow-hidden">
      <SectionHeader title={`Up Next (${queue.length})`} />
      <div className="flex-1 flex flex-col divide-y divide-border overflow-y-auto">
        {queue.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-4 p-4">
            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-on-surface-muted">
              {i + 1}
            </span>
            <QueueItemArt song={entry.song} />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="truncate text-lg font-semibold text-on-surface font-family-accent">
                {entry.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {entry.song.artist}
              </p>
            </div>
            <span className="shrink-0 min-w-8 text-center text-primary text-lg font-bold tabular-nums text-on-surface-muted font-family-accent">
              {entry.voteScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
