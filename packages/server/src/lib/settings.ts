import { DEFAULTS } from "@playplay/shared";
import { resolve as resolvePath } from "node:path";
import type {
  VenueSettings,
  DefaultPlaylistConfig,
  OtpDeliveryMode,
  MusicSource,
  SpotifyCredentialsConfig,
} from "@playplay/shared";
import { parseSettings } from "./prisma.js";
import { tryDecryptSecret } from "./secrets.js";

interface StoredSpotifyCreds {
  clientIdEnc?: string;
  clientSecretEnc?: string;
  relayUrl?: string;
}

function readStoredSpotify(raw: unknown): StoredSpotifyCreds {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: StoredSpotifyCreds = {};
  if (typeof o.clientIdEnc === "string") out.clientIdEnc = o.clientIdEnc;
  if (typeof o.clientSecretEnc === "string") out.clientSecretEnc = o.clientSecretEnc;
  if (typeof o.relayUrl === "string") out.relayUrl = o.relayUrl;
  return out;
}

function publicSpotifyView(stored: StoredSpotifyCreds): SpotifyCredentialsConfig {
  const clientId = tryDecryptSecret(stored.clientIdEnc);
  const configured = !!(stored.clientIdEnc && stored.clientSecretEnc);
  return {
    configured,
    clientIdHint: clientId ? clientId.slice(-4) : null,
    relayUrl: stored.relayUrl ?? null,
  };
}

function parseDefaultPlaylist(raw: unknown, legacyPath: string): DefaultPlaylistConfig {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const source = (obj.source as string) || DEFAULTS.DEFAULT_PLAYLIST_SOURCE;
    const shuffle = typeof obj.shuffle === "boolean" ? obj.shuffle : DEFAULTS.DEFAULT_PLAYLIST_SHUFFLE;
    const out: DefaultPlaylistConfig = {
      source: (source === "local" || source === "spotify" || source === "history") ? source : "history",
      shuffle,
    };
    if (obj.local && typeof obj.local === "object") {
      const l = obj.local as Record<string, unknown>;
      const kind = l.kind === "m3u" ? "m3u" : "folder";
      const path = typeof l.path === "string" ? l.path : "";
      out.local = { kind, path };
    }
    if (obj.spotify && typeof obj.spotify === "object") {
      const sp = obj.spotify as Record<string, unknown>;
      out.spotify = {
        playlistId: String(sp.playlistId ?? ""),
        playlistName: String(sp.playlistName ?? ""),
        ownerName: String(sp.ownerName ?? ""),
        trackCount: typeof sp.trackCount === "number" ? sp.trackCount : 0,
        lastSyncedAt: typeof sp.lastSyncedAt === "string" ? sp.lastSyncedAt : null,
      };
    }
    if (obj.history && typeof obj.history === "object") {
      const h = obj.history as Record<string, unknown>;
      out.history = {
        lookbackDays: typeof h.lookbackDays === "number" ? h.lookbackDays : null,
      };
    }
    return out;
  }

  if (legacyPath) {
    return {
      source: "local",
      shuffle: true,
      local: { kind: "folder", path: legacyPath },
    };
  }

  return {
    source: DEFAULTS.DEFAULT_PLAYLIST_SOURCE,
    shuffle: DEFAULTS.DEFAULT_PLAYLIST_SHUFFLE,
  };
}

export function getVenueSettings(venue: { settings: string | unknown }): VenueSettings {
  const s = parseSettings(venue.settings);
  // Migration: legacy "neon" / "edm" themes were renamed to "synthwave".
  const rawTheme = (s.displayTheme as string) ?? DEFAULTS.DISPLAY_THEME;
  const displayTheme = rawTheme === "neon" || rawTheme === "edm" ? "synthwave" : rawTheme;
  const storedSpotify = readStoredSpotify(s.spotify);
  return {
    voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
    maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
    defaultPlaylist: parseDefaultPlaylist(s.defaultPlaylist, (s.defaultPlaylistPath as string) ?? ""),
    displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
    displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
    displayTheme,
    lanAddressOverride: typeof s.lanAddressOverride === "string" ? s.lanAddressOverride : "",
    otpDeliveryMode: (s.otpDeliveryMode as OtpDeliveryMode) ?? DEFAULTS.OTP_DELIVERY_MODE,
    smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
    musicSource: (s.musicSource as MusicSource) ?? DEFAULTS.MUSIC_SOURCE,
    musicLibraryPath: typeof s.musicLibraryPath === "string" ? s.musicLibraryPath : "",
    spotify: publicSpotifyView(storedSpotify),
    isConfigured: s.isConfigured === true,
  };
}

/**
 * Server-only: returns the decrypted Spotify credentials for a venue, falling
 * back to environment variables for backwards compatibility with installs
 * predating DB-backed credentials. Returns null if no creds are configured.
 */
export function getSpotifyConfig(venue: { settings: string | unknown }): {
  clientId: string;
  clientSecret: string;
  relayUrl: string;
} | null {
  const s = parseSettings(venue.settings);
  const stored = readStoredSpotify(s.spotify);
  const clientId = tryDecryptSecret(stored.clientIdEnc) ?? process.env.SPOTIFY_CLIENT_ID ?? "";
  const clientSecret = tryDecryptSecret(stored.clientSecretEnc) ?? process.env.SPOTIFY_CLIENT_SECRET ?? "";
  const relayUrl = stored.relayUrl || process.env.SPOTIFY_RELAY_URL || DEFAULTS.SPOTIFY_RELAY_URL;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, relayUrl };
}

/**
 * Returns the absolute, canonical filesystem root where this venue's local
 * music library lives. Prefers the per-venue `musicLibraryPath` setting when
 * present, falling back to the `MUSIC_LIBRARY_PATH` env var or `./music`.
 */
export function getLibraryRoot(settings: VenueSettings): string {
  const configured = settings.musicLibraryPath?.trim();
  const raw = configured && configured.length > 0
    ? configured
    : (process.env.MUSIC_LIBRARY_PATH || "./music");
  // UNC stays as-is; everything else gets resolved to absolute.
  if (/^(\\\\|\/\/)/.test(raw)) return raw;
  return resolvePath(raw);
}
