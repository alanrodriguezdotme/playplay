// ---- Default Settings ----

export const DEFAULTS = {
  MAX_SONGS_PER_USER: 3,
  VOTE_THRESHOLD: -5,
  OTP_TTL_SECONDS: 300,
  PORT: 3001,
  DISPLAY_QR_SIZE: 120,
  DISPLAY_SHOW_HEADER: true,
} as const;

// ---- Socket.IO Events ----

export const SOCKET_EVENTS = {
  // Client → Server
  VENUE_JOIN: "venue:join",

  // Server → Client
  QUEUE_UPDATED: "queue:updated",
  NOW_PLAYING_CHANGED: "now-playing:changed",
  QUEUE_ENTRY_ADDED: "queue:entry-added",
  QUEUE_ENTRY_REMOVED: "queue:entry-removed",

  // Client → Server (playback)
  PLAYBACK_ENDED: "playback:ended",

  // Admin → Server → Display (playback control)
  PLAYBACK_PLAY: "playback:play",
  PLAYBACK_PAUSE: "playback:pause",

  // Display → Server → Admin (playback state sync)
  PLAYBACK_STATE: "playback:state",
} as const;

// ---- Roles ----

export const ROLES = {
  PATRON: "PATRON",
  ADMIN: "ADMIN",
} as const;

// ---- Queue Entry Statuses ----

export const QUEUE_STATUS = {
  QUEUED: "QUEUED",
  PLAYING: "PLAYING",
  PLAYED: "PLAYED",
  REMOVED: "REMOVED",
} as const;
