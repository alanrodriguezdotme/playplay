import { useEffect, useRef, useState, useCallback } from "react";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueEntry } from "@playplay/shared";
import type { Socket } from "socket.io-client";
import { getSongStreamUrl } from "../../../api/songs";

interface DisplayAudioPlayerProps {
  nowPlaying: QueueEntry | null;
  queueLength: number;
  socket: Socket | null;
}

export function DisplayAudioPlayer({
  nowPlaying,
  queueLength,
  socket,
}: DisplayAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const lastSongIdRef = useRef<string | null>(null);

  // TODO: REMOVE — temporary auto-advance for testing without admin UI.
  // When there are queued songs but nothing playing, emit playback:ended
  // to bootstrap the play cycle. Admin "Play Now" will replace this.
  useEffect(() => {
    if (!socket || nowPlaying || queueLength === 0) return;
    const timer = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    }, 500);
    return () => clearTimeout(timer);
  }, [socket, nowPlaying, queueLength]);

  const playCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;

    const songId = nowPlaying.song.id;
    if (lastSongIdRef.current === songId) return;
    lastSongIdRef.current = songId;

    audio.src = getSongStreamUrl(songId);
    audio.play().catch(() => {
      // Browser blocked autoplay — show interaction prompt
      setNeedsInteraction(true);
    });
  }, [nowPlaying]);

  // Play when nowPlaying changes
  useEffect(() => {
    if (nowPlaying) {
      playCurrent();
    } else {
      // Nothing playing — stop audio
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        lastSongIdRef.current = null;
      }
    }
  }, [nowPlaying, playCurrent]);

  // Emit playback:ended when song finishes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !socket) return;

    const onEnded = () => {
      lastSongIdRef.current = null;
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [socket]);

  const handleUnlock = () => {
    setNeedsInteraction(false);
    audioRef.current?.play().catch(() => {});
  };

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      {needsInteraction && (
        <button
          onClick={handleUnlock}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
        >
          <div className="rounded-2xl border border-border bg-surface-raised px-8 py-6 text-center shadow-2xl">
            <div className="text-4xl">🔊</div>
            <p className="mt-3 text-lg font-bold text-on-surface">
              Click to enable audio
            </p>
            <p className="mt-1 text-sm text-on-surface-muted">
              Browser requires interaction to play audio
            </p>
          </div>
        </button>
      )}
    </>
  );
}
