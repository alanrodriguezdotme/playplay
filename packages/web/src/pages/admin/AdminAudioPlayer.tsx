import { useEffect, useRef, useState, useCallback } from "react";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueEntry, PlaybackSyncState } from "@playplay/shared";
import type { Socket } from "socket.io-client";
import { getSongStreamUrl } from "../../api/songs";

function getDeviceHint(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

interface AdminAudioPlayerProps {
  nowPlaying: QueueEntry | null;
  queueLength: number;
  socket: Socket | null;
}

export function AdminAudioPlayer({
  nowPlaying,
  queueLength,
  socket,
}: AdminAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const lastSongIdRef = useRef<string | null>(null);
  const [playbackSync, setPlaybackSync] = useState<PlaybackSyncState | null>(
    null,
  );

  const isOwner = playbackSync?.audioOwnerSocketId === socket?.id;

  // Listen for PLAYBACK_SYNC
  useEffect(() => {
    if (!socket) return;
    const onSync = (state: PlaybackSyncState) => {
      setPlaybackSync(state);
    };
    socket.on(SOCKET_EVENTS.PLAYBACK_SYNC, onSync);
    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_SYNC, onSync);
    };
  }, [socket]);

  // Listen for play/pause commands from server (when we're audio owner)
  useEffect(() => {
    if (!socket) return;
    const onPlay = () => {
      audioRef.current?.play().catch(() => {});
    };
    const onPause = () => {
      audioRef.current?.pause();
    };
    socket.on(SOCKET_EVENTS.PLAYBACK_PLAY, onPlay);
    socket.on(SOCKET_EVENTS.PLAYBACK_PAUSE, onPause);
    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_PLAY, onPlay);
      socket.off(SOCKET_EVENTS.PLAYBACK_PAUSE, onPause);
    };
  }, [socket]);

  // Broadcast playback state periodically
  const broadcastState = useCallback(() => {
    const audio = audioRef.current;
    if (!socket || !audio) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_STATE, {
      isPlaying: !audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration || 0,
    });
  }, [socket]);

  // Play the current song when we're the owner and nowPlaying changes
  const playCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;

    const songId = nowPlaying.song.id;
    if (lastSongIdRef.current === songId) return;
    lastSongIdRef.current = songId;

    audio.src = getSongStreamUrl(songId);
    audio.play().catch(() => {
      setNeedsInteraction(true);
    });
  }, [nowPlaying]);

  // When ownership or nowPlaying changes, start/stop audio
  useEffect(() => {
    if (!isOwner) {
      // Not owner — stop audio
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        lastSongIdRef.current = null;
      }
      return;
    }

    if (nowPlaying) {
      playCurrent();
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        lastSongIdRef.current = null;
      }
    }
  }, [isOwner, nowPlaying, playCurrent]);

  // Audio event listeners (ended, play, pause, periodic sync)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !socket || !isOwner) return;

    const onEnded = () => {
      lastSongIdRef.current = null;
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    };
    const onPlay = () => broadcastState();
    const onPause = () => broadcastState();

    const interval = setInterval(() => {
      if (!audio.paused) broadcastState();
    }, 2000);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      clearInterval(interval);
    };
  }, [socket, isOwner, broadcastState]);

  // ---- Actions ----

  const handleClaim = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_CLAIM, { deviceHint: getDeviceHint() });
  };

  const handleRelease = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_RELEASE);
  };

  const handleStartPlayback = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_START);
  };

  const handleUnlock = () => {
    setNeedsInteraction(false);
    audioRef.current?.play().catch(() => {});
  };

  // ---- Render ----

  const hasOwner = !!playbackSync?.audioOwnerSocketId;
  const showStartButton = isOwner && !nowPlaying && queueLength > 0;

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      <div className="shrink-0 border-t border-border bg-surface-raised px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Audio ownership status */}
          <div className="min-w-0 flex-1">
            {isOwner ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-on-surface">
                  Audio playing on this device
                </span>
              </div>
            ) : hasOwner ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="text-xs text-on-surface-muted">
                  Audio on: {playbackSync?.audioOwnerDeviceHint ?? "Unknown"}
                </span>
              </div>
            ) : (
              <span className="text-xs text-on-surface-muted">
                No audio output active
              </span>
            )}
          </div>

          {/* Start playback button (when owner, queue has songs, nothing playing) */}
          {showStartButton && (
            <button
              onClick={handleStartPlayback}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-hover"
            >
              Start Playing
            </button>
          )}

          {/* Claim / Release button */}
          {isOwner ? (
            <button
              onClick={handleRelease}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-on-surface-muted hover:text-on-surface"
            >
              Release Audio
            </button>
          ) : (
            <button
              onClick={handleClaim}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-hover"
            >
              Play Audio Here
            </button>
          )}
        </div>
      </div>

      {/* Autoplay unlock overlay */}
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
