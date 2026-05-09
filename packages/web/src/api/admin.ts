import { apiRequest } from "./client.js";
import type {
  AdminVenueResponse,
  AdminVenueSettingsUpdateBody,
  AdminVenueInfoUpdateBody,
  AdminUsersResponse,
  AdminUserUpdateBody,
  AdminUser,
  AdminSong,
  AdminSongUpdateBody,
  AdminStatsResponse,
  ScanResult,
} from "@playplay/shared";

export async function getVenue(): Promise<AdminVenueResponse> {
  return apiRequest<AdminVenueResponse>("/api/admin/venue");
}

export async function updateVenueInfo(
  body: AdminVenueInfoUpdateBody
): Promise<AdminVenueResponse> {
  return apiRequest<AdminVenueResponse>("/api/admin/venue", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateVenueSettings(
  body: AdminVenueSettingsUpdateBody
): Promise<AdminVenueResponse> {
  return apiRequest<AdminVenueResponse>("/api/admin/venue/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  blocked?: string;
} = {}): Promise<AdminUsersResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.role) qs.set("role", params.role);
  if (params.blocked) qs.set("blocked", params.blocked);
  return apiRequest<AdminUsersResponse>(`/api/admin/users?${qs}`);
}

export async function updateUser(
  id: string,
  body: AdminUserUpdateBody
): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateSong(
  id: string,
  body: AdminSongUpdateBody
): Promise<AdminSong> {
  return apiRequest<AdminSong>(`/api/admin/songs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  return apiRequest<AdminStatsResponse>("/api/admin/stats");
}

export async function triggerMusicScan(): Promise<ScanResult> {
  return apiRequest<ScanResult>("/api/admin/music/scan", {
    method: "POST",
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/admin/change-password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function validateDefaultPlaylistPath(
  kind: "folder" | "m3u",
  path: string,
): Promise<{ valid: boolean; canonical?: string; error?: string; message?: string }> {
  return apiRequest<{ valid: boolean; canonical?: string; error?: string; message?: string }>(
    "/api/admin/default-playlist/validate-path",
    {
      method: "POST",
      body: JSON.stringify({ kind, path }),
    },
  );
}

export async function validateMusicLibraryPath(
  path: string,
): Promise<{ valid: boolean; canonical?: string; error?: string; message?: string }> {
  return apiRequest<{ valid: boolean; canonical?: string; error?: string; message?: string }>(
    "/api/admin/music-library/validate-path",
    {
      method: "POST",
      body: JSON.stringify({ path }),
    },
  );
}
