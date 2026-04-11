import { useEffect, useRef, useState, useCallback } from "react";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueEntry, PlaybackSyncState } from "@playplay/shared";
import type { Socket } from "socket.io-client";
import { getSongStreamUrl } from "../../api/songs";
import { useSpotifyPlayer } from "../../hooks/useSpotifyPlayer";
import { useSpotifyConnect } from "../../hooks/useSpotifyConnect";

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
  const [showConnectDevices, setShowConnectDevices] = useState(false);

  const isOwner = playbackSync?.audioOwnerSocketId === socket?.id;
  const musicSource = playbackSync?.musicSource ?? "local";
  const isSpotify = musicSource === "spotify";
  const currentSongSource = nowPlaying?.song?.source ?? "local";

  // Spotify Web Playback SDK
  const spotify = useSpotifyPlayer(isOwner && isSpotify);
  const spotifyConnect = useSpotifyConnect(isOwner && isSpotify && !spotify.isReady);
  const prevSpotifyStateRef = useRef<any>(null);

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
      if (currentSongSource === "spotify") {
        spotify.resume();
      } else {
        audioRef.current?.play().catch(() => { });
      }
    };
    const onPause = () => {
      if (currentSongSource === "spotify") {
        spotify.pause();
      } else {
        audioRef.current?.pause();
      }
    };
    socket.on(SOCKET_EVENTS.PLAYBACK_PLAY, onPlay);
    socket.on(SOCKET_EVENTS.PLAYBACK_PAUSE, onPause);
    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_PLAY, onPlay);
      socket.off(SOCKET_EVENTS.PLAYBACK_PAUSE, onPause);
    };
  }, [socket, currentSongSource, spotify]);

  // Broadcast playback state periodically (local audio)
  const broadcastLocalState = useCallback(() => {
    const audio = audioRef.current;
    if (!socket || !audio) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_STATE, {
      isPlaying: !audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration || 0,
    });
  }, [socket]);

  // Broadcast playback state from Spotify SDK
  useEffect(() => {
    if (!socket || !isOwner || !isSpotify || !spotify.playerState) return;
    const state = spotify.playerState;
    const interval = setInterval(() => {
      socket.emit(SOCKET_EVENTS.PLAYBACK_STATE, {
        isPlaying: !state.paused,
        currentTime: state.position / 1000,
        duration: state.duration / 1000,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [socket, isOwner, isSpotify, spotify.playerState]);

  // Detect Spotify track end
  useEffect(() => {
    if (!socket || !isOwner || !isSpotify) return;
    const prev = prevSpotifyStateRef.current;
    const curr = spotify.playerState;
    prevSpotifyStateRef.current = curr;

    if (prev && !prev.paused && curr && curr.paused && curr.position === 0) {
      // Track ended — Spotify resets position to 0 when paused at end
      lastSongIdRef.current = null;
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    }
  }, [spotify.playerState, socket, isOwner, isSpotify]);

  // Play the current song (local)
  const playCurrentLocal = useCallback(() => {
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

  // Play the current song (Spotify)
  const playCurrentSpotify = useCallback(async () => {
    if (!nowPlaying?.song.spotifyUri || !spotify.isReady) return;

    const songId = nowPlaying.song.id;
    if (lastSongIdRef.current === songId) return;
    lastSongIdRef.current = songId;

    await spotify.play(nowPlaying.song.spotifyUri);
  }, [nowPlaying, spotify]);

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
      if (currentSongSource === "spotify") {
        playCurrentSpotify();
      } else {
        playCurrentLocal();
      }
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        lastSongIdRef.current = null;
      }
    }
  }, [isOwner, nowPlaying, currentSongSource, playCurrentLocal, playCurrentSpotify]);

  // Audio event listeners for local playback (ended, play, pause, periodic sync)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !socket || !isOwner) return;

    const onEnded = () => {
      lastSongIdRef.current = null;
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    };
    const onPlay = () => broadcastLocalState();
    const onPause = () => broadcastLocalState();

    const interval = setInterval(() => {
      if (!audio.paused) broadcastLocalState();
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
  }, [socket, isOwner, broadcastLocalState]);

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
    audioRef.current?.play().catch(() => { });
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
                  {isSpotify ? "Spotify" : "Audio"} playing on this device
                </span>
                {isSpotify && spotify.error && (
                  <span className="text-xs text-error truncate max-w-[200px]">
                    {spotify.error}
                  </span>
                )}
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

          {/* Spotify Connect fallback button */}
          {isOwner && isSpotify && !spotify.isReady && (
            <button
              onClick={() => {
                setShowConnectDevices(!showConnectDevices);
                if (!showConnectDevices) spotifyConnect.refreshDevices();
              }}
              className="rounded-lg border border-[#1DB954] px-3 py-1.5 text-xs font-medium text-[#1DB954] hover:bg-[#1DB954]/10"
            >
              Spotify Connect
            </button>
          )}

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

        {/* Spotify Connect device picker */}
        {showConnectDevices && isOwner && isSpotify && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-medium text-on-surface mb-2">
              Spotify Connect Devices
            </p>
            {spotifyConnect.loading ? (
              <p className="text-xs text-on-surface-muted">Loading devices...</p>
            ) : spotifyConnect.devices.length === 0 ? (
              <p className="text-xs text-on-surface-muted">
                No devices found. Open Spotify on another device first.
              </p>
            ) : (
              <div className="space-y-1">
                {spotifyConnect.devices.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      spotifyConnect.transferPlayback(d.id);
                      setShowConnectDevices(false);
                    }}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-surface-alt ${d.isActive ? "border border-[#1DB954]" : "border border-border"
                      }`}
                  >
                    <span className="font-medium">{d.name}</span>
                    <span className="text-on-surface-muted">({d.type})</span>
                    {d.isActive && (
                      <span className="ml-auto text-[10px] font-semibold text-[#1DB954]">
                        ACTIVE
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => spotifyConnect.refreshDevices()}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
        )}
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
