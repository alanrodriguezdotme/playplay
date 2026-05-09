import { useEffect, useState } from "react";
import type { Song } from "@playplay/shared";
import { getSongArtworkUrl } from "../../api/songs";

interface SongArtworkProps {
  song: Pick<Song, "id" | "source" | "artworkUrl">;
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
}

/**
 * Renders a song's album art. Uses Spotify's artworkUrl when available,
 * otherwise falls back to the server's embedded-art endpoint for local files.
 * Renders a neutral placeholder if the image fails to load.
 */
export function SongArtwork({
  song,
  className,
  alt = "",
  fallback,
}: SongArtworkProps) {
  const [failed, setFailed] = useState(false);

  // Reset error state when the song changes.
  useEffect(() => {
    setFailed(false);
  }, [song.id]);

  const url =
    song.source === "spotify" && song.artworkUrl
      ? song.artworkUrl
      : song.id
        ? getSongArtworkUrl(song.id)
        : null;

  if (!url || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-primary/10 text-2xl ${className ?? ""}`}
      >
        {fallback ?? "🎵"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
