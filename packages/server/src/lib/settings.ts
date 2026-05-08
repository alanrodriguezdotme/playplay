import { DEFAULTS } from "@playplay/shared";
import type {
  VenueSettings,
  DefaultPlaylistConfig,
  OtpDeliveryMode,
  MusicSource,
} from "@playplay/shared";
import { parseSettings } from "./prisma.js";

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
  return {
    voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
    maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
    defaultPlaylist: parseDefaultPlaylist(s.defaultPlaylist, (s.defaultPlaylistPath as string) ?? ""),
    displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
    displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
    otpDeliveryMode: (s.otpDeliveryMode as OtpDeliveryMode) ?? DEFAULTS.OTP_DELIVERY_MODE,
    smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
    musicSource: (s.musicSource as MusicSource) ?? DEFAULTS.MUSIC_SOURCE,
    allowFullCatalogSearch: (s.allowFullCatalogSearch as boolean) ?? DEFAULTS.ALLOW_FULL_CATALOG_SEARCH,
  };
}
