import type {
  AdminVenueSettingsUpdateBody,
  DefaultPlaylistConfig,
} from "@playplay/shared";

export interface SettingsMergeError {
  status: number;
  code: string;
  message: string;
}

export interface SettingsMergeResult {
  merged: Record<string, unknown>;
  /** Set when the caller requested a default-playlist change; the route owns the async rebuild. */
  nextDefaultPlaylist: DefaultPlaylistConfig | null;
}

export function validateDefaultPlaylist(input: unknown): DefaultPlaylistConfig | { error: string } {
  if (!input || typeof input !== "object") return { error: "defaultPlaylist must be an object" };
  const obj = input as Record<string, unknown>;
  const source = obj.source;
  if (source !== "history" && source !== "local" && source !== "spotify") {
    return { error: "defaultPlaylist.source must be 'history', 'local', or 'spotify'" };
  }
  const shuffle = typeof obj.shuffle === "boolean" ? obj.shuffle : true;
  const out: DefaultPlaylistConfig = { source, shuffle };

  if (source === "local") {
    if (!obj.local || typeof obj.local !== "object") return { error: "defaultPlaylist.local is required for source=local" };
    const l = obj.local as Record<string, unknown>;
    if (l.kind !== "folder" && l.kind !== "m3u") return { error: "defaultPlaylist.local.kind must be 'folder' or 'm3u'" };
    if (typeof l.path !== "string" || l.path.trim().length === 0) return { error: "defaultPlaylist.local.path is required" };
    out.local = { kind: l.kind, path: l.path };
  }

  if (source === "spotify") {
    if (!obj.spotify || typeof obj.spotify !== "object") return { error: "defaultPlaylist.spotify is required for source=spotify" };
    const sp = obj.spotify as Record<string, unknown>;
    if (typeof sp.playlistId !== "string" || sp.playlistId.trim().length === 0) return { error: "defaultPlaylist.spotify.playlistId is required" };
    out.spotify = {
      playlistId: sp.playlistId,
      playlistName: typeof sp.playlistName === "string" ? sp.playlistName : "",
      ownerName: typeof sp.ownerName === "string" ? sp.ownerName : "",
      trackCount: typeof sp.trackCount === "number" ? sp.trackCount : 0,
      lastSyncedAt: typeof sp.lastSyncedAt === "string" ? sp.lastSyncedAt : null,
    };
  }

  if (source === "history") {
    const h = (obj.history as Record<string, unknown>) ?? {};
    out.history = {
      lookbackDays: typeof h.lookbackDays === "number" && h.lookbackDays > 0 ? h.lookbackDays : null,
    };
  }

  return out;
}

/**
 * Builds the next persisted settings object from the venue's RAW stored settings
 * plus an admin update body. Crucially, this spreads from the raw JSON — never the
 * lossy public view from getVenueSettings() — so private fields the public view
 * omits (e.g. encrypted Spotify credentials under `spotify.clientIdEnc`) are
 * preserved across a settings save.
 *
 * Handles only the synchronous fields. The async-validated `musicLibraryPath`
 * (filesystem check) and the default-playlist rebuild remain the route's
 * responsibility; `nextDefaultPlaylist` is returned so the route can perform the
 * rebuild and persist the enriched result.
 */
export function buildMergedVenueSettings(
  raw: Record<string, unknown>,
  body: AdminVenueSettingsUpdateBody,
): SettingsMergeResult | { error: SettingsMergeError } {
  const merged: Record<string, unknown> = { ...raw };
  let nextDefaultPlaylist: DefaultPlaylistConfig | null = null;

  const fail = (message: string): { error: SettingsMergeError } => ({
    error: { status: 400, code: "validation", message },
  });

  if (body.voteThreshold !== undefined) {
    if (typeof body.voteThreshold !== "number") return fail("voteThreshold must be a number");
    merged.voteThreshold = body.voteThreshold;
  }
  if (body.maxSongsPerUser !== undefined) {
    if (typeof body.maxSongsPerUser !== "number" || body.maxSongsPerUser < 1) return fail("maxSongsPerUser must be >= 1");
    merged.maxSongsPerUser = body.maxSongsPerUser;
  }
  if (body.defaultPlaylist !== undefined) {
    const parsed = validateDefaultPlaylist(body.defaultPlaylist);
    if ("error" in parsed) return fail(parsed.error);
    nextDefaultPlaylist = parsed;
    merged.defaultPlaylist = parsed;
    // Drop the legacy field if it exists in storage
    delete merged.defaultPlaylistPath;
  }
  if (body.displayQrSize !== undefined) {
    if (typeof body.displayQrSize !== "number" || body.displayQrSize < 60 || body.displayQrSize > 300) {
      return fail("displayQrSize must be between 60 and 300");
    }
    merged.displayQrSize = body.displayQrSize;
  }
  if (body.displayShowHeader !== undefined) {
    if (typeof body.displayShowHeader !== "boolean") return fail("displayShowHeader must be a boolean");
    merged.displayShowHeader = body.displayShowHeader;
  }
  if (body.displayTheme !== undefined) {
    const validThemes = ["dark", "light", "midnight", "sunset", "synthwave", "country", "disco", "punk", "pop", "hiphop"];
    if (typeof body.displayTheme !== "string" || !validThemes.includes(body.displayTheme)) {
      return fail("Invalid displayTheme");
    }
    merged.displayTheme = body.displayTheme;
  }
  if (body.otpDeliveryMode !== undefined) {
    const validModes = ["none", "venue-display", "sms-gateway", "paid"];
    if (!validModes.includes(body.otpDeliveryMode)) return fail("Invalid otpDeliveryMode");
    merged.otpDeliveryMode = body.otpDeliveryMode;
  }
  if (body.smsGatewayUrl !== undefined) {
    if (typeof body.smsGatewayUrl !== "string") return fail("smsGatewayUrl must be a string");
    merged.smsGatewayUrl = body.smsGatewayUrl;
  }
  if (body.musicSource !== undefined) {
    const validSources = ["local", "spotify"];
    if (!validSources.includes(body.musicSource)) return fail("musicSource must be 'local' or 'spotify'");
    merged.musicSource = body.musicSource;
  }
  if (body.allowFullCatalogSearch !== undefined) {
    if (typeof body.allowFullCatalogSearch !== "boolean") return fail("allowFullCatalogSearch must be a boolean");
    merged.allowFullCatalogSearch = body.allowFullCatalogSearch;
  }

  return { merged, nextDefaultPlaylist };
}
