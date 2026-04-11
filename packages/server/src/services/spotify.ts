import SpotifyWebApi from "spotify-web-api-node";
import { prisma } from "../lib/prisma.js";
import type { SpotifyTrack } from "@playplay/shared";

const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
];

function createClient(): SpotifyWebApi {
    return new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: process.env.SPOTIFY_RELAY_URL,
    });
}

async function getAuthenticatedClient(venueId: string): Promise<SpotifyWebApi> {
    const auth = await prisma.spotifyAuth.findUnique({ where: { venueId } });
    if (!auth) throw new Error("Spotify not connected for this venue");

    const client = createClient();
    client.setAccessToken(auth.accessToken);
    client.setRefreshToken(auth.refreshToken);

    // Auto-refresh if token expires within 5 minutes
    if (auth.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        const refreshed = await client.refreshAccessToken();
        const newExpiry = new Date(Date.now() + refreshed.body.expires_in * 1000);

        await prisma.spotifyAuth.update({
            where: { venueId },
            data: {
                accessToken: refreshed.body.access_token,
                expiresAt: newExpiry,
            },
        });

        client.setAccessToken(refreshed.body.access_token);
    }

    return client;
}

export function getAuthUrl(venueId: string, returnUrl?: string): string {
    const client = createClient();
    const port = process.env.PORT || "3001";
    // state = venueId:port:returnUrl — relay uses port, callback-local uses venueId + returnUrl
    const state = `${venueId}:${port}:${returnUrl || ""}`;
    return client.createAuthorizeURL(SCOPES, state);
}

export async function handleCallback(
    code: string,
    venueId: string
): Promise<{ spotifyUserId: string; displayName: string; isPremium: boolean }> {
    const client = createClient();
    const grant = await client.authorizationCodeGrant(code);

    client.setAccessToken(grant.body.access_token);
    client.setRefreshToken(grant.body.refresh_token);

    const me = await client.getMe();
    const isPremium = me.body.product === "premium";
    const spotifyUserId = me.body.id;
    const displayName = me.body.display_name || me.body.id;

    if (!isPremium) {
        throw new SpotifyPremiumRequiredError(
            "Spotify Premium is required for playback. Please upgrade your Spotify account."
        );
    }

    const expiresAt = new Date(Date.now() + grant.body.expires_in * 1000);

    await prisma.spotifyAuth.upsert({
        where: { venueId },
        update: {
            accessToken: grant.body.access_token,
            refreshToken: grant.body.refresh_token,
            expiresAt,
            spotifyUserId,
            displayName,
            isPremium,
        },
        create: {
            venueId,
            accessToken: grant.body.access_token,
            refreshToken: grant.body.refresh_token,
            expiresAt,
            spotifyUserId,
            displayName,
            isPremium,
        },
    });

    return { spotifyUserId, displayName, isPremium };
}

export async function getStatus(venueId: string) {
    const auth = await prisma.spotifyAuth.findUnique({ where: { venueId } });
    if (!auth) {
        return { connected: false, spotifyUserId: null, displayName: null, isPremium: false };
    }
    return {
        connected: true,
        spotifyUserId: auth.spotifyUserId,
        displayName: auth.displayName,
        isPremium: auth.isPremium,
    };
}

export async function disconnect(venueId: string): Promise<void> {
    await prisma.spotifyAuth.deleteMany({ where: { venueId } });
}

export async function getAccessToken(venueId: string): Promise<{ accessToken: string; expiresIn: number }> {
    const client = await getAuthenticatedClient(venueId);
    const auth = await prisma.spotifyAuth.findUnique({ where: { venueId } });
    if (!auth) throw new Error("Spotify not connected");
    const expiresIn = Math.max(0, Math.floor((auth.expiresAt.getTime() - Date.now()) / 1000));
    return { accessToken: client.getAccessToken()!, expiresIn };
}

export async function searchTracks(
    venueId: string,
    query: string,
    limit = 10,
    offset = 0
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
    const client = await getAuthenticatedClient(venueId);
    const token = client.getAccessToken()!;

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Spotify search failed (${resp.status}): ${body}`);
    }
    const data = await resp.json();
    const items = data.tracks?.items ?? [];
    const total = data.tracks?.total ?? 0;

    const tracks: SpotifyTrack[] = items.map((t) => ({
        spotifyTrackId: t.id,
        spotifyUri: t.uri,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duration: Math.round(t.duration_ms / 1000),
        artworkUrl: t.album.images[0]?.url ?? null,
        previewUrl: t.preview_url ?? null,
    }));

    return { tracks, total };
}

export async function getTrack(
    venueId: string,
    spotifyTrackId: string
): Promise<SpotifyTrack> {
    const client = await getAuthenticatedClient(venueId);
    const result = await client.getTrack(spotifyTrackId);
    const t = result.body;

    return {
        spotifyTrackId: t.id,
        spotifyUri: t.uri,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duration: Math.round(t.duration_ms / 1000),
        artworkUrl: t.album.images[0]?.url ?? null,
        previewUrl: t.preview_url ?? null,
    };
}

export async function importSpotifyTrack(
    venueId: string,
    spotifyTrackId: string
): Promise<string> {
    // Check if already imported
    const existing = await prisma.song.findUnique({
        where: { spotifyTrackId_venueId: { spotifyTrackId, venueId } },
    });
    if (existing) return existing.id;

    const track = await getTrack(venueId, spotifyTrackId);

    const song = await prisma.song.create({
        data: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            source: "spotify",
            spotifyTrackId: track.spotifyTrackId,
            spotifyUri: track.spotifyUri,
            artworkUrl: track.artworkUrl,
            previewUrl: track.previewUrl,
            filePath: null,
            venueId,
        },
    });

    return song.id;
}

// Get available Spotify Connect devices
export async function getDevices(venueId: string) {
    const client = await getAuthenticatedClient(venueId);
    const result = await client.getMyDevices();
    return result.body.devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
    }));
}

// Transfer playback to a specific device
export async function transferPlayback(venueId: string, deviceId: string) {
    const client = await getAuthenticatedClient(venueId);
    await client.transferMyPlayback([deviceId]);
}

// Play a track on a specific device (Connect API)
export async function playTrack(venueId: string, spotifyUri: string, deviceId?: string) {
    const client = await getAuthenticatedClient(venueId);
    await client.play({ uris: [spotifyUri], ...(deviceId ? { device_id: deviceId } : {}) });
}

// Pause playback (Connect API)
export async function pausePlayback(venueId: string, deviceId?: string) {
    const client = await getAuthenticatedClient(venueId);
    await client.pause(deviceId ? { device_id: deviceId } : {});
}

export class SpotifyPremiumRequiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SpotifyPremiumRequiredError";
    }
}
