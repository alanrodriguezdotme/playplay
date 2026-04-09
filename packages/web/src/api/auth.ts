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

// ---- Legacy OTP Auth (admin login) ----

export function requestOtp(phone: string, venueSlug: string, email?: string) {
  return apiRequest<{ message: string }>("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone, venueSlug, email }),
  });
}

export function verifyOtp(phone: string, code: string, venueSlug: string) {
  return apiRequest<AuthResponse>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, code, venueSlug }),
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
