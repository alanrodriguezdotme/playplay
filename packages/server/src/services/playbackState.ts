import type { PlaybackSyncState } from "@playplay/shared";

interface PlaybackState {
  audioOwnerSocketId: string | null;
  audioOwnerDeviceHint: string | null;
  isPlaying: boolean;
  currentSongId: string | null;
  currentTime: number;
  duration: number;
  musicSource: "local" | "spotify";
}

const venuePlayback = new Map<string, PlaybackState>();

function getOrCreate(venueId: string): PlaybackState {
  let state = venuePlayback.get(venueId);
  if (!state) {
    state = {
      audioOwnerSocketId: null,
      audioOwnerDeviceHint: null,
      isPlaying: false,
      currentSongId: null,
      currentTime: 0,
      duration: 0,
      musicSource: "local",
    };
    venuePlayback.set(venueId, state);
  }
  return state;
}

export function getPlaybackState(venueId: string): PlaybackSyncState {
  const s = getOrCreate(venueId);
  return { ...s };
}

export function claimAudio(
  venueId: string,
  socketId: string,
  deviceHint: string,
): { previousOwner: string | null } {
  const s = getOrCreate(venueId);
  const previousOwner = s.audioOwnerSocketId;
  s.audioOwnerSocketId = socketId;
  s.audioOwnerDeviceHint = deviceHint;
  return { previousOwner };
}

export function releaseAudio(venueId: string, socketId: string): boolean {
  const s = getOrCreate(venueId);
  if (s.audioOwnerSocketId !== socketId) return false;
  s.audioOwnerSocketId = null;
  s.audioOwnerDeviceHint = null;
  s.isPlaying = false;
  return true;
}

export function clearOwnerOnDisconnect(socketId: string): string | null {
  for (const [venueId, state] of venuePlayback) {
    if (state.audioOwnerSocketId === socketId) {
      state.audioOwnerSocketId = null;
      state.audioOwnerDeviceHint = null;
      state.isPlaying = false;
      return venueId;
    }
  }
  return null;
}

export function isAudioOwner(venueId: string, socketId: string): boolean {
  const s = venuePlayback.get(venueId);
  return s?.audioOwnerSocketId === socketId;
}

export function setPlaying(venueId: string, playing: boolean): void {
  const s = getOrCreate(venueId);
  s.isPlaying = playing;
}

export function updatePlaybackPosition(
  venueId: string,
  currentTime: number,
  duration: number,
): void {
  const s = getOrCreate(venueId);
  s.currentTime = currentTime;
  s.duration = duration;
}

export function setCurrentSong(venueId: string, songId: string | null, source?: "local" | "spotify"): void {
  const s = getOrCreate(venueId);
  s.currentSongId = songId;
  s.currentTime = 0;
  s.duration = 0;
  if (source) s.musicSource = source;
  if (!songId) {
    s.isPlaying = false;
  }
}

// ---- Default-playlist fallback cursor (per-venue, in-memory) ----

interface FallbackCursor {
  /** Unique key for the current default-playlist config; bumping this resets the cursor. */
  configKey: string;
  /** ID of the last fallback Song picked (used by ordered playback to advance). */
  lastSongId: string | null;
}

const fallbackCursors = new Map<string, FallbackCursor>();

export function getFallbackCursor(venueId: string, configKey: string): string | null {
  const c = fallbackCursors.get(venueId);
  if (!c || c.configKey !== configKey) return null;
  return c.lastSongId;
}

export function setFallbackCursor(venueId: string, configKey: string, songId: string | null): void {
  fallbackCursors.set(venueId, { configKey, lastSongId: songId });
}

export function clearFallbackCursor(venueId: string): void {
  fallbackCursors.delete(venueId);
}

