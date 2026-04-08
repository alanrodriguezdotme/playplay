import { apiRequest } from "./client";
import type { AuthResponse, UserProfile } from "@playplay/shared";

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
