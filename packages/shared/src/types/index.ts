// ---- Roles & Statuses ----

export type UserRole = "PATRON" | "ADMIN";
export type QueueEntryStatus = "QUEUED" | "PLAYING" | "PLAYED" | "REMOVED";

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
}

export interface UserProfile {
  id: string;
  phone: string;
  displayName: string | null;
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
}

export interface QueueEntry {
  id: string;
  song: Song;
  addedBy: { id: string; displayName: string | null } | null;
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

export interface RequestOtpBody {
  phone: string;
  venueSlug: string;
  email?: string;
}

export interface VerifyOtpBody {
  phone: string;
  code: string;
  venueSlug: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface SetDisplayNameBody {
  displayName: string;
}

export interface AddToQueueBody {
  songId: string;
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
}

export interface AdminUser {
  id: string;
  phone: string;
  displayName: string | null;
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
  filePath: string;
  blocked: boolean;
  isDefault: boolean;
  totalPlays: number;
  totalAdds: number;
  createdAt: string;
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
