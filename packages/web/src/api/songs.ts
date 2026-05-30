import { apiRequest } from "./client.js";
import type { Song, SongSearchResult } from "@playplay/shared";

export interface PaginatedSongs {
  songs: Song[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getSongs(page = 1, limit = 50): Promise<PaginatedSongs> {
  return apiRequest<PaginatedSongs>(
    `/api/songs?page=${page}&limit=${limit}`
  );
}

export async function searchSongs(
  query: string,
  page = 1,
  limit = 50
): Promise<SongSearchResult> {
  return apiRequest<SongSearchResult>(
    `/api/songs/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
}

export function getSongStreamUrl(songId: string): string {
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}/api/songs/${songId}/stream`;
}

export function getSongArtworkUrl(songId: string): string {
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}/api/songs/${songId}/artwork`;
}

export async function getMusicSource(): Promise<{
  musicSource: "local" | "spotify";
}> {
  return apiRequest("/api/songs/music-source");
}

export async function triggerMusicScan(): Promise<{
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}> {
  return apiRequest("/api/admin/music/scan", { method: "POST" });
}
