// ---- Roles & Statuses ----

export type UserRole = "PATRON" | "ADMIN";
export type QueueEntryStatus = "QUEUED" | "PLAYING" | "PLAYED" | "REMOVED";
export type MusicSource = "local" | "spotify";

// ---- Models (mirroring Prisma, used on the client) ----

export interface Venue {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  settings: VenueSettings;
  createdAt: string;
}

export interface VenueSettings {
  voteThreshold: number;
  maxSongsPerUser: number;
  defaultPlaylist: DefaultPlaylistConfig;
  displayQrSize: number;
  displayShowHeader: boolean;
  displayTheme: string;
  /**
   * Manual override for the host/IP used in the QR code and patron URL on the
   * Now Playing display. Empty string = auto-detect the LAN address. Useful
   * when auto-detection picks the wrong adapter (common on Windows laptops with
   * VPN/Hyper-V/WSL interfaces) or when a stable hostname is preferred.
   */
  lanAddressOverride: string;
  otpDeliveryMode: OtpDeliveryMode;
  smsGatewayUrl: string;
  musicSource: MusicSource;
  musicLibraryPath: string;
  /** Per-venue Spotify app credentials. Stored encrypted server-side. */
  spotify?: SpotifyCredentialsConfig;
  /** Set true after first-run setup completes. */
  isConfigured?: boolean;
}

export interface SpotifyCredentialsConfig {
  /** Whether the venue has client id + secret stored. */
  configured: boolean;
  /** Last 4 chars of the client id, for UI display. Never returns the secret. */
  clientIdHint: string | null;
  /** Override for the OAuth relay URL; null/undefined uses the project default. */
  relayUrl: string | null;
}

// ---- Default Playlist (plays when queue is empty) ----

export type DefaultPlaylistSourceKind = "history" | "local" | "spotify";
export type LocalDefaultPlaylistKind = "folder" | "m3u";

export interface LocalDefaultPlaylistSource {
  kind: LocalDefaultPlaylistKind;
  path: string;
}

export interface SpotifyDefaultPlaylistSource {
  playlistId: string;
  playlistName: string;
  ownerName: string;
  trackCount: number;
  lastSyncedAt: string | null;
}

export interface HistoryDefaultPlaylistSource {
  lookbackDays: number | null;
}

export interface DefaultPlaylistConfig {
  source: DefaultPlaylistSourceKind;
  shuffle: boolean;
  local?: LocalDefaultPlaylistSource;
  spotify?: SpotifyDefaultPlaylistSource;
  history?: HistoryDefaultPlaylistSource;
}

export interface UserProfile {
  id: string;
  phone: string | null;
  deviceId: string | null;
  displayName: string | null;
  avatarEmoji: string | null;
  role: UserRole;
  venueId: string;
  isBlocked: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  totalPlays: number;
  totalAdds: number;
  isBlocked: boolean;
  isFallbackOnly?: boolean;
  source: MusicSource;
  spotifyTrackId?: string | null;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  spotifyUri?: string | null;
}

export interface QueueEntry {
  id: string;
  song: Song;
  addedBy: { id: string; displayName: string | null; avatarEmoji: string | null; role: UserRole } | null;
  status: QueueEntryStatus;
  voteScore: number;
  currentUserVote?: number | null;
  createdAt: string;
  playedAt: string | null;
}

export interface Vote {
  id: string;
  queueEntryId: string;
  userId: string;
  value: number;
  createdAt: string;
}

// ---- API Request/Response Types ----

export interface AdminLoginBody {
  email: string;
  password: string;
  venueSlug: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface SetDisplayNameBody {
  displayName: string;
}

// ---- Device Auth ----

export interface DeviceRegisterBody {
  deviceId: string;
  venueSlug: string;
  displayName: string;
  avatarEmoji: string;
}

export interface DeviceLoginBody {
  deviceId: string;
  venueSlug: string;
}

export interface UpdateProfileBody {
  displayName?: string;
  avatarEmoji?: string;
}

// ---- OTP Delivery Settings ----

export type OtpDeliveryMode = "none" | "venue-display" | "sms-gateway" | "paid";

export interface OtpDeliverySettings {
  otpDeliveryMode: OtpDeliveryMode;
  smsGatewayUrl?: string;
}

export interface VerifyVenueOtpBody {
  deviceId: string;
  code: string;
  venueSlug: string;
}

export interface AddToQueueBody {
  songId?: string;
  spotifyTrackId?: string;
}

export interface VoteBody {
  value: 1 | -1 | 0;
}

export interface QueueResponse {
  nowPlaying: QueueEntry | null;
  queue: QueueEntry[];
}

export interface SongSearchResult {
  songs: Song[];
  total: number;
}

export interface PaginatedSongs {
  songs: Song[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export type ScanJobStatus = "running" | "completed" | "failed" | "cancelled";
export type ScanJobPhase = "discovering" | "indexing" | "pruning" | "done";

export interface ScanJob {
  id: string;
  status: ScanJobStatus;
  phase: ScanJobPhase;
  startedAt: string;
  finishedAt: string | null;
  total: number;
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: string[];
  currentFile?: string;
  errorMessage?: string;
}

export interface ReorderQueueBody {
  entryIds: string[];
}

export interface QueueHistoryResponse {
  entries: QueueEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// ---- Display Settings (public) ----

export interface DisplaySettings {
  displayQrSize: number;
  displayShowHeader: boolean;
  displayTheme: string;
  lanIp: string | null;
}

// ---- Playback State (server → clients) ----

export interface PlaybackSyncState {
  audioOwnerSocketId: string | null;
  audioOwnerDeviceHint: string | null;
  isPlaying: boolean;
  currentSongId: string | null;
  currentTime: number;
  duration: number;
  musicSource: MusicSource;
}

// ---- Admin API Types ----

export interface AdminVenueResponse {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  settings: VenueSettings;
}

export interface AdminVenueSettingsUpdateBody {
  voteThreshold?: number;
  maxSongsPerUser?: number;
  defaultPlaylist?: DefaultPlaylistConfig;
  displayQrSize?: number;
  displayShowHeader?: boolean;
  displayTheme?: string;
  lanAddressOverride?: string;
  otpDeliveryMode?: OtpDeliveryMode;
  smsGatewayUrl?: string;
  musicSource?: MusicSource;
  musicLibraryPath?: string;
}

export interface AdminVenueInfoUpdateBody {
  name?: string;
  email?: string;
  phone?: string;
}

export interface AdminUser {
  id: string;
  phone: string | null;
  deviceId: string | null;
  displayName: string | null;
  avatarEmoji: string | null;
  role: UserRole;
  blocked: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserUpdateBody {
  blocked?: boolean;
  role?: UserRole;
}

export interface AdminSongUpdateBody {
  blocked: boolean;
}

export interface AdminSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  filePath: string | null;
  blocked: boolean;
  isDefault: boolean;
  isFallbackOnly: boolean;
  totalPlays: number;
  totalAdds: number;
  createdAt: string;
  source: MusicSource;
  spotifyTrackId: string | null;
  artworkUrl: string | null;
}

export interface AdminStatsResponse {
  totalSongs: number;
  totalUnblockedSongs: number;
  totalUsers: number;
  activeUsersToday: number;
  totalPlayed: number;
  totalQueued: number;
  topSongs: { id: string; title: string; artist: string; totalPlays: number }[];
  recentActivity: QueueEntry[];
}

// ---- Spotify Types ----

export interface SpotifyStatus {
  connected: boolean;
  spotifyUserId: string | null;
  displayName: string | null;
  isPremium: boolean;
}

export interface SpotifyTrack {
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface SpotifySearchResult {
  tracks: SpotifyTrack[];
  total: number;
}

export interface SpotifyTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  ownerName: string;
  trackCount: number;
  artworkUrl: string | null;
  isPublic: boolean | null;
}

export interface SpotifyPlaylistListResult {
  playlists: SpotifyPlaylistSummary[];
  total: number;
}

export interface DefaultPlaylistRebuildResult {
  source: DefaultPlaylistSourceKind;
  trackCount: number;
  errors: string[];
}
