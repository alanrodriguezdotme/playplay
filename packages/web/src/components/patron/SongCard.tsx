import { useState, useEffect, useCallback } from "react";
import type { Song } from "@playplay/shared";
import { useQueue } from "../../contexts/QueueContext";
import { getSongStreamUrl } from "../../api/songs";

interface SongCardProps {
  song: Song;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Shared audio instance — only one song previews at a time
let sharedAudio: HTMLAudioElement | null = null;
let currentPlayingSongId: string | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function stopSharedAudio() {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.src = "";
    sharedAudio = null;
  }
  currentPlayingSongId = null;
  notifyListeners();
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

export function SongCard({ song }: SongCardProps) {
  const { queuedSongIds, addSong } = useQueue();
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Subscribe to shared audio state changes
  useEffect(() => {
    const update = () => setIsPlaying(currentPlayingSongId === song.id);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, [song.id]);

  const togglePreview = useCallback(() => {
    if (currentPlayingSongId === song.id) {
      stopSharedAudio();
      return;
    }

    stopSharedAudio();
    const audio = new Audio(getSongStreamUrl(song.id));
    sharedAudio = audio;
    currentPlayingSongId = song.id;
    notifyListeners();

    audio.addEventListener("ended", stopSharedAudio);
    audio.addEventListener("error", stopSharedAudio);
    audio.play().catch(stopSharedAudio);
  }, [song.id]);

  const isInQueue = queuedSongIds.has(song.id);

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      await addSong(song.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={togglePreview}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          isPlaying
            ? "bg-primary text-on-primary"
            : "bg-surface-alt text-on-surface-muted hover:text-on-surface"
        }`}
        aria-label={isPlaying ? "Stop preview" : "Preview song"}
      >
        {isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">
          {song.title}
        </p>
        <p className="truncate text-xs text-on-surface-muted">
          {song.artist}
          {song.album ? ` · ${song.album}` : ""}
        </p>
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-on-surface-muted">
        {formatDuration(song.duration)}
      </span>
      {isInQueue ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">
          In Queue
        </span>
      ) : (
        <button
          onClick={handleAdd}
          disabled={isAdding}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      )}
    </div>
  );
}
