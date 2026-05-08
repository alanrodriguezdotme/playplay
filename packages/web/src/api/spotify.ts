import { apiRequest } from "./client.js";
import type {
    SpotifyStatus,
    SpotifySearchResult,
    SpotifyTokenResponse,
    SpotifyPlaylistListResult,
    SpotifyDefaultPlaylistSource,
} from "@playplay/shared";

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

export async function listSpotifyPlaylists(query?: string, limit?: number, offset?: number): Promise<SpotifyPlaylistListResult> {
    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    if (limit) qs.set("limit", String(limit));
    if (offset) qs.set("offset", String(offset));
    const qsStr = qs.toString();
    return apiRequest<SpotifyPlaylistListResult>(
        `/api/spotify/playlists${qsStr ? `?${qsStr}` : ""}`,
    );
}

export async function syncSpotifyDefaultPlaylist(): Promise<{
    trackCount: number;
    errors: string[];
    spotify: SpotifyDefaultPlaylistSource;
}> {
    return apiRequest("/api/spotify/default-playlist/sync", { method: "POST" });
}
