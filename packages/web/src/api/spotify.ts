import { apiRequest } from "./client.js";
import type { SpotifyStatus, SpotifySearchResult, SpotifyTokenResponse } from "@playplay/shared";

export async function getSpotifyAuthUrl(): Promise<{ url: string }> {
    const returnUrl = encodeURIComponent(window.location.href);
    return apiRequest<{ url: string }>(`/api/spotify/auth-url?returnUrl=${returnUrl}`);
}

export async function getSpotifyStatus(): Promise<SpotifyStatus> {
    return apiRequest<SpotifyStatus>("/api/spotify/status");
}

export async function disconnectSpotify(): Promise<void> {
    await apiRequest("/api/spotify/disconnect", { method: "DELETE" });
}

export async function getSpotifyToken(): Promise<SpotifyTokenResponse> {
    return apiRequest<SpotifyTokenResponse>("/api/spotify/token");
}

export async function searchSpotifyCatalog(
    query: string,
    limit = 10,
    offset = 0
): Promise<SpotifySearchResult> {
    return apiRequest<SpotifySearchResult>(
        `/api/spotify/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
}

export async function importSpotifyTrack(
    spotifyTrackId: string
): Promise<{ songId: string }> {
    return apiRequest<{ songId: string }>("/api/spotify/import", {
        method: "POST",
        body: JSON.stringify({ spotifyTrackId }),
    });
}

export async function getSpotifyDevices(): Promise<{
    devices: { id: string; name: string; type: string; isActive: boolean }[];
}> {
    return apiRequest("/api/spotify/devices");
}

export async function transferSpotifyPlayback(deviceId: string): Promise<void> {
    await apiRequest("/api/spotify/transfer", {
        method: "PUT",
        body: JSON.stringify({ deviceId }),
    });
}
