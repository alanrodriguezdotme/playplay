import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueEntry, PlaybackSyncState } from "@playplay/shared";
import type { Socket } from "socket.io-client";
import { getSongStreamUrl } from "../../api/songs";
import { playNow } from "../../api/queue";
import { useSpotifyPlayer } from "../../hooks/useSpotifyPlayer";
import { useSpotifyConnect } from "../../hooks/useSpotifyConnect";
import { UserBadge } from "../../components/common/UserBadge";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AdminAudioPlayerProps {
  nowPlaying: QueueEntry | null;
  queue: QueueEntry[];
  socket: Socket | null;
}

export function AdminAudioPlayer({
  nowPlaying,
  queue,
  socket,
}: AdminAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  // Tracks the entry ID currently loaded into the player. Keyed on entry (not
  // song) so that a fallback re-pick of the same song produces a fresh load.
  const lastEntryIdRef = useRef<string | null>(null);
  const [playbackSync, setPlaybackSync] = useState<PlaybackSyncState | null>(
    null,
  );
  const [showConnectDevices, setShowConnectDevices] = useState(false);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [localTime, setLocalTime] = useState(0);
  const lastSyncTimestampRef = useRef(0);

  const isOwner = playbackSync?.audioOwnerSocketId === socket?.id;
  const musicSource = playbackSync?.musicSource ?? "local";
  const isSpotify = musicSource === "spotify";
  const currentSongSource = nowPlaying?.song?.source ?? "local";
  const needsSpotify = isSpotify || currentSongSource === "spotify";

  const syncedTime = playbackSync?.currentTime ?? 0;
  const duration = playbackSync?.duration ?? 0;
  const isPlaying = playbackSync?.isPlaying ?? false;

  // Sync localTime from server broadcasts
  useEffect(() => {
    setLocalTime(syncedTime);
    lastSyncTimestampRef.current = Date.now();
  }, [syncedTime]);

  // Reset scrubber when song changes
  useEffect(() => {
    setLocalTime(0);
  }, [nowPlaying?.song?.id]);

  // Reset scrubber when this device claims ownership (song restarts)
  useEffect(() => {
    if (isOwner) {
      setLocalTime(0);
    }
  }, [isOwner]);

  // Interpolate localTime smoothly while playing
  useEffect(() => {
    if (!isPlaying || isSeeking) return;
    const interval = setInterval(() => {
      setLocalTime((prev) => {
        const next = prev + 0.25;
        return duration > 0 ? Math.min(next, duration) : next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, isSeeking, duration]);

  // Spotify Web Playback SDK — enable if owner and either server or song says spotify
  const spotify = useSpotifyPlayer(isOwner && needsSpotify);
  const spotifyConnect = useSpotifyConnect(
    isOwner && needsSpotify && !spotify.isReady,
  );
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

  // Helper: ensure local audio element has the correct src loaded
  const ensureLocalAudioLoaded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return audio;
    if (lastEntryIdRef.current !== nowPlaying.id || audio.readyState === 0) {
      audio.src = getSongStreamUrl(nowPlaying.song.id);
      audio.volume = volume;
      lastEntryIdRef.current = nowPlaying.id;
    }
    return audio;
  }, [nowPlaying, volume]);

  // Listen for play/pause commands from server (when we're audio owner)
  useEffect(() => {
    if (!socket) return;
    const onPlay = () => {
      if (currentSongSource === "spotify") {
        spotify.resume();
      } else {
        const audio = ensureLocalAudioLoaded();
        audio?.play().catch(() => {});
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
  }, [socket, currentSongSource, spotify, ensureLocalAudioLoaded]);

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

  // Broadcast playback state from Spotify SDK.
  // Fire immediately on every state change so the rest of the app reflects
  // track changes/play/pause without the previous 2s setInterval delay.
  // The interval is just a low-frequency keep-alive for position drift.
  useEffect(() => {
    if (!socket || !isOwner || !needsSpotify || !spotify.playerState) return;
    const state = spotify.playerState;
    socket.emit(SOCKET_EVENTS.PLAYBACK_STATE, {
      isPlaying: !state.paused,
      currentTime: state.position / 1000,
      duration: state.duration / 1000,
    });
    const interval = setInterval(() => {
      socket.emit(SOCKET_EVENTS.PLAYBACK_STATE, {
        isPlaying: !state.paused,
        currentTime: state.position / 1000,
        duration: state.duration / 1000,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [socket, isOwner, needsSpotify, spotify.playerState]);

  // Detect Spotify track end
  useEffect(() => {
    if (!socket || !isOwner || !needsSpotify) return;
    const prev = prevSpotifyStateRef.current;
    const curr = spotify.playerState;
    prevSpotifyStateRef.current = curr;

    if (prev && !prev.paused && curr && curr.paused && curr.position === 0) {
      // Track ended — Spotify resets position to 0 when paused at end.
      // Do NOT clear lastEntryIdRef here: the SDK keeps firing
      // player_state_changed events while we wait for the server to
      // broadcast the next nowPlaying, and clearing the ref would let
      // the "play current" effect re-issue play() for the just-ended
      // song (causing the previous track to repeat).
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    }
  }, [spotify.playerState, socket, isOwner, needsSpotify]);

  // Play the current song (local)
  const playCurrentLocal = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;

    if (lastEntryIdRef.current === nowPlaying.id) return;
    lastEntryIdRef.current = nowPlaying.id;

    audio.src = getSongStreamUrl(nowPlaying.song.id);
    audio.volume = volume;
    audio.play().catch(() => {
      setNeedsInteraction(true);
    });
  }, [nowPlaying, volume]);

  // Play the current song (Spotify)
  const playCurrentSpotify = useCallback(async () => {
    if (!nowPlaying?.song.spotifyUri || !spotify.isReady) return;

    if (lastEntryIdRef.current === nowPlaying.id) return;
    lastEntryIdRef.current = nowPlaying.id;

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
        lastEntryIdRef.current = null;
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
        lastEntryIdRef.current = null;
      }
    }
  }, [
    isOwner,
    nowPlaying,
    currentSongSource,
    playCurrentLocal,
    playCurrentSpotify,
  ]);

  // Audio event listeners for local playback (ended, play, pause, periodic sync)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !socket || !isOwner) return;

    const onEnded = () => {
      // See note in the Spotify end detector — leave lastEntryIdRef alone
      // so the current song isn't re-loaded before the next nowPlaying arrives.
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

  const handleClaimClick = () => {
    if (isPlaying && hasOwner) {
      setShowClaimConfirm(true);
    } else {
      handleClaim();
    }
  };

  const handleStartPlayback = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_START);
  };

  const handleUnlock = () => {
    setNeedsInteraction(false);
    audioRef.current?.play().catch(() => {});
  };

  const handlePlayPause = useCallback(() => {
    if (!socket) return;
    if (isPlaying) {
      socket.emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
      // Directly control audio when we're the owner (no round-trip delay)
      if (isOwner) {
        if (currentSongSource === "spotify") {
          spotify.pause();
        } else {
          audioRef.current?.pause();
        }
      }
    } else {
      socket.emit(SOCKET_EVENTS.PLAYBACK_PLAY);
      // Directly control audio when we're the owner (no round-trip delay)
      if (isOwner) {
        if (currentSongSource === "spotify") {
          spotify.resume();
        } else {
          const audio = ensureLocalAudioLoaded();
          audio?.play().catch(() => setNeedsInteraction(true));
        }
      }
    }
  }, [
    socket,
    isPlaying,
    isOwner,
    currentSongSource,
    spotify,
    ensureLocalAudioLoaded,
  ]);

  const handleSkip = useCallback(async () => {
    if (queue.length > 0) {
      await playNow(queue[0].id);
      return;
    }
    // No queued items: advance via the same path as a natural track end so
    // the server picks the configured fallback (history / playlist).
    if (!socket || !nowPlaying) return;
    if (isOwner) {
      if (currentSongSource === "spotify") {
        spotify.pause().catch(() => {});
      } else {
        audioRef.current?.pause();
      }
    }
    socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
  }, [queue, nowPlaying, socket, isOwner, currentSongSource, spotify]);

  const handleVolumeChange = useCallback(
    (value: number) => {
      setVolume(value);
      if (currentSongSource === "spotify") {
        spotify.setVolume(value);
      } else if (audioRef.current) {
        audioRef.current.volume = value;
      }
    },
    [currentSongSource, spotify],
  );

  const handleSeek = useCallback(
    (time: number) => {
      setLocalTime(time);
      if (currentSongSource === "spotify") {
        spotify.seek(time * 1000);
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
        broadcastLocalState();
      }
    },
    [currentSongSource, spotify, broadcastLocalState],
  );

  // ---- Render ----

  const hasOwner = !!playbackSync?.audioOwnerSocketId;
  const showStartButton = isOwner && !nowPlaying && queue.length > 0;
  const displayTime = isSeeking ? seekValue : localTime;

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      <div className="shrink-0 border-t border-border bg-surface-raised">
        {isOwner ? (
          /* ---- Expanded control bar (audio owner) ---- */
          <div className="p-4 space-y-4">
            {/* Row 1: Song info | Controls | Volume | Release */}
            <div className="flex items-center gap-3">
              {/* Song info */}
              <div className="min-w-0 flex-1">
                {nowPlaying ? (
                  <div className="flex flex-col gap-1">
                    <p className="truncate text-sm text-on-surface font-family-accent">
                      {nowPlaying.song.title}
                    </p>
                    <p className="truncate text-xs text-on-surface-muted">
                      {nowPlaying.song.artist} ·{" "}
                      <UserBadge user={nowPlaying.addedBy} />
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success animate-pulse" />
                    <span className="text-xs font-medium text-on-surface">
                      {needsSpotify ? "Spotify" : "Audio"} playing on this
                      device
                    </span>
                  </div>
                )}
              </div>

              {/* Spotify Connect fallback */}
              {needsSpotify && !spotify.isReady && (
                <button
                  onClick={() => {
                    setShowConnectDevices(!showConnectDevices);
                    if (!showConnectDevices) spotifyConnect.refreshDevices();
                  }}
                  className="rounded-lg border border-[#1DB954] px-2.5 py-1 text-xs font-medium text-[#1DB954] hover:bg-[#1DB954]/10"
                >
                  Spotify Connect
                </button>
              )}

              {/* Playback controls */}
              <div className="flex items-center gap-1">
                {showStartButton && (
                  <button
                    onClick={handleStartPlayback}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-hover"
                  >
                    Start Playing
                  </button>
                )}
                {nowPlaying && (
                  <>
                    <button
                      onClick={handlePlayPause}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary hover:bg-primary-hover transition-colors"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause
                          fill="currentColor"
                          stroke="none"
                          className="h-4 w-4 text-on-primary"
                        />
                      ) : (
                        <Play
                          fill="currentColor"
                          stroke="none"
                          className="h-4 w-4 text-on-primary"
                        />
                      )}
                    </button>
                    <button
                      onClick={handleSkip}
                      disabled={queue.length === 0 && !nowPlaying}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-alt transition-colors disabled:opacity-40"
                      title="Skip"
                    >
                      <SkipForward className="h-4 w-4 text-on-surface" />
                    </button>
                  </>
                )}
              </div>

              {/* Volume slider */}
              <div className="hidden sm:flex items-center gap-2 w-32">
                {volume === 0 ? (
                  <VolumeX className="h-4 w-4 shrink-0 text-on-surface-muted" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4 shrink-0 text-on-surface-muted" />
                ) : (
                  <Volume2 className="h-4 w-4 shrink-0 text-on-surface-muted" />
                )}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none bg-border cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Row 2: Scrubber bar */}
            {nowPlaying && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] tabular-nums text-on-surface-muted w-8 text-right">
                  {formatDuration(displayTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 1}
                  step="0.5"
                  value={displayTime}
                  onChange={(e) => {
                    setIsSeeking(true);
                    setSeekValue(Number(e.target.value));
                  }}
                  onMouseUp={() => {
                    handleSeek(seekValue);
                    setIsSeeking(false);
                  }}
                  onTouchEnd={() => {
                    handleSeek(seekValue);
                    setIsSeeking(false);
                  }}
                  className="flex-1 h-1 rounded-full appearance-none bg-border cursor-pointer accent-primary"
                />
                <span className="text-[10px] tabular-nums text-on-surface-muted w-8">
                  {formatDuration(duration)}
                </span>
              </div>
            )}

            {/* Spotify error */}
            {needsSpotify && spotify.error && (
              <p className="text-xs text-error truncate">{spotify.error}</p>
            )}

            {/* Spotify Connect device picker */}
            {showConnectDevices && needsSpotify && (
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-medium text-on-surface mb-2">
                  Spotify Connect Devices
                </p>
                {spotifyConnect.loading ? (
                  <p className="text-xs text-on-surface-muted">
                    Loading devices...
                  </p>
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
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-surface-alt ${d.isActive ? "border border-[#1DB954]" : "border border-border"}`}
                      >
                        <span className="font-medium">{d.name}</span>
                        <span className="text-on-surface-muted">
                          ({d.type})
                        </span>
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
        ) : (
          /* ---- Compact bar (not owner) ---- */
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              {hasOwner ? (
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
            <button
              onClick={handleClaimClick}
              className="bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-hover"
            >
              Play Audio Here
            </button>
          </div>
        )}
      </div>

      {/* Autoplay unlock overlay — portaled to body to escape stacking context */}
      {needsInteraction &&
        createPortal(
          <button
            onClick={handleUnlock}
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
          >
            <div className="rounded-2xl border border-border bg-surface-raised px-8 py-6 text-center shadow-2xl">
              <div className="text-4xl">🔊</div>
              <p className="mt-3 text-lg text-on-surface">
                Click to enable audio
              </p>
              <p className="mt-1 text-sm text-on-surface-muted">
                Browser requires interaction to play audio
              </p>
            </div>
          </button>,
          document.body,
        )}
      <ConfirmDialog
        open={showClaimConfirm}
        title="Take over audio playback?"
        message={`Music is currently playing on ${playbackSync?.audioOwnerDeviceHint ?? "another device"}. Claiming playback here will stop it there.`}
        confirmLabel="Play Here"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowClaimConfirm(false);
          handleClaim();
        }}
        onCancel={() => setShowClaimConfirm(false)}
      />
    </>
  );
}
