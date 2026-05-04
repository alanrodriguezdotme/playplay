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
  defaultPlaylistPath: string;
  displayQrSize: number;
  displayShowHeader: boolean;
  otpDeliveryMode: OtpDeliveryMode;
  smsGatewayUrl: string;
  musicSource: MusicSource;
  allowFullCatalogSearch: boolean;
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
  source: MusicSource;
  spotifyTrackId?: string | null;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  spotifyUri?: string | null;
}

export interface QueueEntry {
  id: string;
  song: Song;
  addedBy: { id: string; displayName: string | null; avatarEmoji: string | null } | null;
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
  defaultPlaylistPath?: string;
  displayQrSize?: number;
  displayShowHeader?: boolean;
  otpDeliveryMode?: OtpDeliveryMode;
  smsGatewayUrl?: string;
  musicSource?: MusicSource;
  allowFullCatalogSearch?: boolean;
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
