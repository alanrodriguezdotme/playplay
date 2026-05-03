import { apiRequest } from "./client";
import type { AuthResponse, UserProfile } from "@playplay/shared";

// ---- Device Auth ----

export function deviceRegister(
  deviceId: string,
  displayName: string,
  avatarEmoji: string,
  venueCode?: string,
) {
  return apiRequest<AuthResponse | { error: string; message: string; requiresVenueCode: boolean }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ deviceId, displayName, avatarEmoji, venueCode }),
    },
  );
}

export function deviceLogin(deviceId: string) {
  return apiRequest<AuthResponse>("/api/auth/device-login", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
}

export function getVenueInfo() {
  return apiRequest<{ name: string; slug: string; requiresVenueCode: boolean }>(
    "/api/auth/venue-info",
  );
}

export function getVenueCode() {
  return apiRequest<{ code: string; expiresAt: number }>(
    "/api/auth/venue-code",
  );
}

export function updateProfile(data: { displayName?: string; avatarEmoji?: string }) {
  return apiRequest<UserProfile>("/api/auth/update-profile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Admin Login ----

export function adminLogin(email: string, password: string) {
  return apiRequest<AuthResponse>("/api/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
