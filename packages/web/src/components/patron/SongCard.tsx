import { useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
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

export function SongCard({ song }: SongCardProps) {
  const { queuedSongIds, queuedSpotifyTrackIds, addSong } = useQueue();
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
    // For Spotify songs, use previewUrl (30s preview) if available; for local, stream from server
    const url =
      song.source === "spotify" && song.previewUrl
        ? song.previewUrl
        : getSongStreamUrl(song.id);
    const audio = new Audio(url);
    sharedAudio = audio;
    currentPlayingSongId = song.id;
    notifyListeners();

    audio.addEventListener("ended", stopSharedAudio);
    audio.addEventListener("error", stopSharedAudio);
    audio.play().catch(stopSharedAudio);
  }, [song.id, song.source, song.previewUrl]);

  const isInQueue =
    (song.id && queuedSongIds.has(song.id)) ||
    (song.spotifyTrackId && queuedSpotifyTrackIds.has(song.spotifyTrackId)) ||
    false;

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      if (song.id) {
        await addSong(song.id);
      } else if (song.spotifyTrackId) {
        await addSong(undefined, song.spotifyTrackId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Artwork for Spotify songs */}
      {song.source === "spotify" && song.artworkUrl ? (
        <button
          onClick={togglePreview}
          className="relative h-10 w-10 shrink-0 rounded overflow-hidden group"
          aria-label={isPlaying ? "Stop preview" : "Preview song"}
        >
          <img
            src={song.artworkUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <span
            className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
              isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {isPlaying ? (
              <Pause
                fill="currentColor"
                stroke="none"
                className="h-4 w-4 text-white"
              />
            ) : (
              <Play
                fill="currentColor"
                stroke="none"
                className="h-4 w-4 text-white"
              />
            )}
          </span>
        </button>
      ) : (
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
            <Pause fill="currentColor" stroke="none" className="h-4 w-4" />
          ) : (
            <Play fill="currentColor" stroke="none" className="h-4 w-4" />
          )}
        </button>
      )}
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
