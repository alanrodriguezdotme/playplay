import { apiRequest } from "./client";
import type { AuthResponse, UserProfile } from "@playplay/shared";

// ---- Device Auth ----

export function deviceRegister(
  deviceId: string,
  venueSlug: string,
  displayName: string,
  avatarEmoji: string,
  venueCode?: string,
) {
  return apiRequest<AuthResponse | { error: string; message: string; requiresVenueCode: boolean }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ deviceId, venueSlug, displayName, avatarEmoji, venueCode }),
    },
  );
}

export function deviceLogin(deviceId: string, venueSlug: string) {
  return apiRequest<AuthResponse>("/api/auth/device-login", {
    method: "POST",
    body: JSON.stringify({ deviceId, venueSlug }),
  });
}

export function getVenueInfo(venueSlug: string) {
  return apiRequest<{ requiresVenueCode: boolean }>(
    `/api/auth/venue-info/${encodeURIComponent(venueSlug)}`,
  );
}

export function getVenueCode(venueSlug: string) {
  return apiRequest<{ code: string; expiresAt: number }>(
    `/api/auth/venue-code/${encodeURIComponent(venueSlug)}`,
  );
}

export function updateProfile(data: { displayName?: string; avatarEmoji?: string }) {
  return apiRequest<UserProfile>("/api/auth/update-profile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Admin Login ----

export function adminLogin(email: string, password: string, venueSlug: string) {
  return apiRequest<AuthResponse>("/api/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ email, password, venueSlug }),
  });
}

export function setDisplayName(displayName: string) {
  return apiRequest<UserProfile>("/api/auth/set-display-name", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export function getMe() {
  return apiRequest<UserProfile>("/api/auth/me");
}
