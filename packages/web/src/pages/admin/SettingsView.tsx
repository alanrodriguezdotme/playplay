import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { useToast } from "../../contexts/ToastContext";
import {
  useTheme,
  BUILT_IN_THEMES,
  THEME_LABELS,
} from "../../contexts/ThemeContext";
import {
  getVenue,
  updateVenueSettings,
  updateVenueInfo,
  validateMusicLibraryPath,
  updateSpotifyCredentials,
  clearSpotifyCredentials,
} from "../../api/admin";
import {
  getSpotifyStatus,
  getSpotifyAuthUrl,
  disconnectSpotify,
} from "../../api/spotify";
import type {
  AdminVenueResponse,
  AdminVenueSettingsUpdateBody,
  OtpDeliveryMode,
  MusicSource,
  SpotifyStatus,
  DefaultPlaylistConfig,
} from "@playplay/shared";
import SectionHeader from "../../components/common/SectionHeader";
import {
  FormInput,
  FormToggle,
  FormRadioGroup,
  FormSlider,
} from "../../components/common/FormFields";
import { useDebounce } from "../../hooks/useDebounce";
import { DefaultPlaylistConfigSection } from "../../components/admin/DefaultPlaylistConfigSection";

const DEFAULT_PLAYLIST_FALLBACK: DefaultPlaylistConfig = {
  source: "history",
  shuffle: true,
  history: { lookbackDays: null },
};

export function SettingsView() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [venue, setVenue] = useState<AdminVenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  // Venue info state
  const [venueName, setVenueName] = useState("");
  const [venueEmail, setVenueEmail] = useState("");
  const [venuePhone, setVenuePhone] = useState("");

  // Settings form state
  const [voteThreshold, setVoteThreshold] = useState(-5);
  const [maxSongsPerUser, setMaxSongsPerUser] = useState(3);
  const [defaultPlaylist, setDefaultPlaylist] = useState<DefaultPlaylistConfig>(
    DEFAULT_PLAYLIST_FALLBACK,
  );
  const [displayQrSize, setDisplayQrSize] = useState(120);
  const [displayShowHeader, setDisplayShowHeader] = useState(true);
  const [displayTheme, setDisplayTheme] = useState<string>("dark");
  const [otpDeliveryMode, setOtpDeliveryMode] =
    useState<OtpDeliveryMode>("none");
  const [smsGatewayUrl, setSmsGatewayUrl] = useState("");
  const [musicSource, setMusicSource] = useState<MusicSource>("local");
  const [musicLibraryPath, setMusicLibraryPath] = useState("");
  const [musicLibraryPathDraft, setMusicLibraryPathDraft] = useState("");
  const [libraryPathValidating, setLibraryPathValidating] = useState(false);
  const [libraryPathSaving, setLibraryPathSaving] = useState(false);
  const [libraryPathMsg, setLibraryPathMsg] = useState<string | null>(null);
  const [libraryPathOk, setLibraryPathOk] = useState<boolean | null>(null);
  const [allowFullCatalogSearch, setAllowFullCatalogSearch] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(
    null,
  );
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [credsClientId, setCredsClientId] = useState("");
  const [credsClientSecret, setCredsClientSecret] = useState("");
  const [credsRelayUrl, setCredsRelayUrl] = useState("");
  const [credsSaving, setCredsSaving] = useState(false);
  const [credsEditing, setCredsEditing] = useState(false);

  // Debounced values for auto-save
  const debouncedVenueName = useDebounce(venueName, 800);
  const debouncedVenueEmail = useDebounce(venueEmail, 800);
  const debouncedVenuePhone = useDebounce(venuePhone, 800);
  const debouncedVoteThreshold = useDebounce(voteThreshold, 800);
  const debouncedMaxSongsPerUser = useDebounce(maxSongsPerUser, 800);
  const debouncedDisplayQrSize = useDebounce(displayQrSize, 800);
  const debouncedDisplayShowHeader = useDebounce(displayShowHeader, 400);
  const debouncedDisplayTheme = useDebounce(displayTheme, 400);
  const debouncedOtpDeliveryMode = useDebounce(otpDeliveryMode, 400);
  const debouncedSmsGatewayUrl = useDebounce(smsGatewayUrl, 800);
  const debouncedMusicSource = useDebounce(musicSource, 400);
  const debouncedAllowFullCatalogSearch = useDebounce(
    allowFullCatalogSearch,
    400,
  );

  const fetchVenue = useCallback(async () => {
    try {
      const data = await getVenue();
      setVenue(data);
      setVenueName(data.name);
      setVenueEmail(data.email);
      setVenuePhone(data.phone);
      setVoteThreshold(data.settings.voteThreshold);
      setMaxSongsPerUser(data.settings.maxSongsPerUser);
      setDefaultPlaylist(data.settings.defaultPlaylist);
      setDisplayQrSize(data.settings.displayQrSize);
      setDisplayShowHeader(data.settings.displayShowHeader);
      setDisplayTheme(data.settings.displayTheme);
      setOtpDeliveryMode(data.settings.otpDeliveryMode);
      setSmsGatewayUrl(data.settings.smsGatewayUrl);
      setMusicSource(data.settings.musicSource);
      setMusicLibraryPath(data.settings.musicLibraryPath ?? "");
      setMusicLibraryPathDraft(data.settings.musicLibraryPath ?? "");
      setAllowFullCatalogSearch(data.settings.allowFullCatalogSearch);
      setCredsRelayUrl(data.settings.spotify?.relayUrl ?? "");
      // Fetch Spotify status (only if creds are present, otherwise it 400s)
      if (data.settings.spotify?.configured) {
        try {
          const status = await getSpotifyStatus();
          setSpotifyStatus(status);
        } catch {
          // Spotify not configured — ignore
        }
      } else {
        setSpotifyStatus(null);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load settings",
        "error",
      );
    } finally {
      setLoading(false);
      // Mark initialized after the debounced values settle
      setTimeout(() => {
        initializedRef.current = true;
      }, 1000);
    }
  }, [showToast]);

  useEffect(() => {
    fetchVenue();
  }, [fetchVenue]);

  // Auto-save venue info
  useEffect(() => {
    if (!initializedRef.current || !venue) return;
    if (
      debouncedVenueName === venue.name &&
      debouncedVenueEmail === venue.email &&
      debouncedVenuePhone === venue.phone
    )
      return;
    if (!debouncedVenueName.trim()) return;

    updateVenueInfo({
      name: debouncedVenueName,
      email: debouncedVenueEmail,
      phone: debouncedVenuePhone,
    })
      .then((updated) => {
        setVenue(updated);
        showToast("Venue info saved", "success");
      })
      .catch((err) => {
        showToast(
          err instanceof Error ? err.message : "Failed to save venue info",
          "error",
        );
      });
  }, [debouncedVenueName, debouncedVenueEmail, debouncedVenuePhone]);

  // Auto-save settings (excluding defaultPlaylist — that has its own handler)
  useEffect(() => {
    if (!initializedRef.current || !venue) return;

    const body: AdminVenueSettingsUpdateBody = {
      voteThreshold: debouncedVoteThreshold,
      maxSongsPerUser: debouncedMaxSongsPerUser,
      displayQrSize: debouncedDisplayQrSize,
      displayShowHeader: debouncedDisplayShowHeader,
      displayTheme: debouncedDisplayTheme,
      otpDeliveryMode: debouncedOtpDeliveryMode,
      smsGatewayUrl: debouncedSmsGatewayUrl,
      musicSource: debouncedMusicSource,
      allowFullCatalogSearch: debouncedAllowFullCatalogSearch,
    };

    const s = venue.settings;
    if (
      debouncedVoteThreshold === s.voteThreshold &&
      debouncedMaxSongsPerUser === s.maxSongsPerUser &&
      debouncedDisplayQrSize === s.displayQrSize &&
      debouncedDisplayShowHeader === s.displayShowHeader &&
      debouncedDisplayTheme === s.displayTheme &&
      debouncedOtpDeliveryMode === s.otpDeliveryMode &&
      debouncedSmsGatewayUrl === s.smsGatewayUrl &&
      debouncedMusicSource === s.musicSource &&
      debouncedAllowFullCatalogSearch === s.allowFullCatalogSearch
    )
      return;

    updateVenueSettings(body)
      .then((updated) => {
        setVenue(updated);
        showToast("Settings saved", "success");
      })
      .catch((err) => {
        showToast(
          err instanceof Error ? err.message : "Failed to save",
          "error",
        );
      });
  }, [
    debouncedVoteThreshold,
    debouncedMaxSongsPerUser,
    debouncedDisplayQrSize,
    debouncedDisplayShowHeader,
    debouncedDisplayTheme,
    debouncedOtpDeliveryMode,
    debouncedSmsGatewayUrl,
    debouncedMusicSource,
    debouncedAllowFullCatalogSearch,
  ]);

  // Save default-playlist config explicitly (rebuild can be slow / surface errors).
  const [savingDefaultPlaylist, setSavingDefaultPlaylist] = useState(false);
  const handleDefaultPlaylistChange = useCallback(
    (next: DefaultPlaylistConfig) => {
      setDefaultPlaylist(next);
      if (!initializedRef.current || !venue) return;
      setSavingDefaultPlaylist(true);
      updateVenueSettings({ defaultPlaylist: next })
        .then((updated) => {
          setVenue(updated);
          setDefaultPlaylist(updated.settings.defaultPlaylist);
          showToast("Default playlist saved", "success");
        })
        .catch((err) => {
          showToast(
            err instanceof Error
              ? err.message
              : "Failed to save default playlist",
            "error",
          );
        })
        .finally(() => setSavingDefaultPlaylist(false));
    },
    [venue, showToast],
  );

  const handleValidateLibraryPath = useCallback(async () => {
    setLibraryPathValidating(true);
    setLibraryPathMsg(null);
    setLibraryPathOk(null);
    try {
      const trimmed = musicLibraryPathDraft.trim();
      if (trimmed.length === 0) {
        setLibraryPathOk(true);
        setLibraryPathMsg("Will use server default (MUSIC_LIBRARY_PATH env)");
        return;
      }
      const res = await validateMusicLibraryPath(trimmed);
      if (res.valid) {
        setLibraryPathOk(true);
        setLibraryPathMsg(`OK · ${res.canonical ?? trimmed}`);
      } else {
        setLibraryPathOk(false);
        setLibraryPathMsg(res.message ?? "Invalid path");
      }
    } catch (err) {
      setLibraryPathOk(false);
      setLibraryPathMsg(
        err instanceof Error ? err.message : "Validation failed",
      );
    } finally {
      setLibraryPathValidating(false);
    }
  }, [musicLibraryPathDraft]);

  const handleSaveLibraryPath = useCallback(async () => {
    if (!venue) return;
    setLibraryPathSaving(true);
    try {
      const updated = await updateVenueSettings({
        musicLibraryPath: musicLibraryPathDraft.trim(),
      });
      setVenue(updated);
      setMusicLibraryPath(updated.settings.musicLibraryPath ?? "");
      setMusicLibraryPathDraft(updated.settings.musicLibraryPath ?? "");
      setLibraryPathOk(true);
      setLibraryPathMsg("Saved");
      showToast("Music library path saved", "success");
    } catch (err) {
      setLibraryPathOk(false);
      const msg = err instanceof Error ? err.message : "Failed to save";
      setLibraryPathMsg(msg);
      showToast(msg, "error");
    } finally {
      setLibraryPathSaving(false);
    }
  }, [venue, musicLibraryPathDraft, showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-on-surface-muted">Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Settings" />

      {/* Venue Info */}
      {venue && (
        <div className="flex flex-col">
          <SectionHeader title="Venue Info" showTopBorder />
          <div className="grid gap-4 sm:grid-cols-2 p-4">
            <FormInput
              label="Name"
              value={venueName}
              onChange={setVenueName}
              compact
            />
            <div>
              <label className="block text-xs text-on-surface-muted mb-1">
                Slug
              </label>
              <p className="py-2.5 text-sm font-medium text-on-surface-muted">
                {venue.slug}
              </p>
            </div>
            <FormInput
              label="Email"
              type="email"
              value={venueEmail}
              onChange={setVenueEmail}
              compact
            />
            <FormInput
              label="Phone"
              type="tel"
              value={venuePhone}
              onChange={setVenuePhone}
              compact
            />
          </div>
        </div>
      )}

      {/* Queue Settings */}
      <div className="flex flex-col">
        <SectionHeader title="Queue Settings" showTopBorder />
        <FormInput
          label="Vote Threshold"
          description="Songs with a vote score at or below this value are automatically removed."
          type="number"
          value={voteThreshold}
          onChange={(v) => setVoteThreshold(parseInt(v) || 0)}
          max={0}
        />
        <FormInput
          label="Max Songs Per User"
          description="Maximum number of songs a patron can have in the queue at once."
          type="number"
          value={maxSongsPerUser}
          onChange={(v) => setMaxSongsPerUser(Math.max(1, parseInt(v) || 1))}
          min={1}
        />
      </div>

      {/* Music Source */}
      <div className="flex flex-col">
        <SectionHeader title="Music Source" showTopBorder />
        <p className="p-4 text-xs text-on-surface-muted">
          Choose where songs come from. You can switch between local files and
          Spotify at any time.
        </p>

        <FormRadioGroup
          name="musicSource"
          options={[
            {
              value: "local" as const,
              label: "Local Files",
              desc: "Play audio files from the server's music library.",
            },
            {
              value: "spotify" as const,
              label: "Spotify",
              desc: "Stream music from Spotify (Premium required).",
            },
          ]}
          value={musicSource}
          onChange={setMusicSource}
        />
        <div className="m-4 mt-0 bg-surface-raised">
          {musicSource === "local" && (
            <div className="space-y-3 p-4">
              <h4 className="text-sm font-medium text-on-surface">
                Music Library Folder
              </h4>
              <p className="text-xs text-on-surface-muted">
                Folder on the server (or a UNC share like{" "}
                <code className="text-xs">\\server\share\music</code>) that
                holds your MP3s. Leave blank to use the server's default (
                <code className="text-xs">MUSIC_LIBRARY_PATH</code> env var).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={musicLibraryPathDraft}
                  onChange={(e) => setMusicLibraryPathDraft(e.target.value)}
                  placeholder="C:\Music or \\server\share\music"
                  className="flex-1 border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleValidateLibraryPath}
                  disabled={libraryPathValidating}
                  className="border border-border px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface disabled:opacity-50"
                >
                  {libraryPathValidating ? "…" : "Validate"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveLibraryPath}
                  disabled={
                    libraryPathSaving ||
                    musicLibraryPathDraft.trim() === musicLibraryPath
                  }
                  className="border border-primary bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
                >
                  {libraryPathSaving ? "…" : "Save"}
                </button>
              </div>
              {libraryPathMsg && (
                <p
                  className={`mt-1 text-xs ${libraryPathOk ? "text-success" : "text-error"}`}
                >
                  {libraryPathMsg}
                </p>
              )}
            </div>
          )}
          {musicSource === "spotify" && (
            <div className="space-y-3 p-4">
              <div className="space-y-2 border border-outline/30 p-3">
                <h4 className="text-sm font-medium text-on-surface">
                  Spotify App Credentials
                </h4>
                <p className="text-xs text-on-surface-muted">
                  Create a free Spotify app at{" "}
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    developer.spotify.com/dashboard
                  </a>
                  , then paste this Redirect URI into the app's settings:
                </p>
                <code className="block break-all bg-surface-variant px-2 py-1 text-[11px] text-on-surface">
                  {credsRelayUrl || "https://spotify-relay.vercel.app"}
                </code>

                {!credsEditing && venue?.settings.spotify?.configured ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 text-xs text-on-surface">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      Configured (id ending in{" "}
                      <code className="bg-surface-variant px-1">
                        ...{venue.settings.spotify.clientIdHint ?? "????"}
                      </code>
                      )
                    </span>
                    <button
                      onClick={() => {
                        setCredsClientId("");
                        setCredsClientSecret("");
                        setCredsEditing(true);
                      }}
                      className="border border-outline px-3 py-1.5 text-xs hover:bg-surface-variant"
                    >
                      Replace
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            "Clear Spotify credentials? This also disconnects the current OAuth session.",
                          )
                        )
                          return;
                        setCredsSaving(true);
                        try {
                          const updated = await clearSpotifyCredentials();
                          setVenue(updated);
                          setSpotifyStatus(null);
                          showToast("Spotify credentials cleared", "success");
                        } catch (err) {
                          showToast(
                            err instanceof Error
                              ? err.message
                              : "Failed to clear",
                            "error",
                          );
                        } finally {
                          setCredsSaving(false);
                        }
                      }}
                      disabled={credsSaving}
                      className="border border-error/50 px-3 py-1.5 text-xs text-error hover:bg-error/10 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FormInput
                      label="Client ID"
                      value={credsClientId}
                      onChange={setCredsClientId}
                      placeholder="From your Spotify app dashboard"
                      compact
                    />
                    <FormInput
                      label="Client Secret"
                      value={credsClientSecret}
                      onChange={setCredsClientSecret}
                      placeholder="Never shown again after saving"
                      type="password"
                      compact
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          if (
                            !credsClientId.trim() ||
                            !credsClientSecret.trim()
                          ) {
                            showToast(
                              "Both Client ID and Secret are required",
                              "error",
                            );
                            return;
                          }
                          setCredsSaving(true);
                          try {
                            const updated = await updateSpotifyCredentials({
                              clientId: credsClientId.trim(),
                              clientSecret: credsClientSecret.trim(),
                              relayUrl: credsRelayUrl.trim() || null,
                            });
                            setVenue(updated);
                            setCredsClientId("");
                            setCredsClientSecret("");
                            setCredsEditing(false);
                            showToast("Spotify credentials saved", "success");
                          } catch (err) {
                            showToast(
                              err instanceof Error
                                ? err.message
                                : "Failed to save",
                              "error",
                            );
                          } finally {
                            setCredsSaving(false);
                          }
                        }}
                        disabled={credsSaving}
                        className="bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
                      >
                        {credsSaving ? "Saving..." : "Save credentials"}
                      </button>
                      {venue?.settings.spotify?.configured && (
                        <button
                          onClick={() => {
                            setCredsClientId("");
                            setCredsClientSecret("");
                            setCredsEditing(false);
                          }}
                          className="border border-outline px-3 py-1.5 text-xs hover:bg-surface-variant"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <h4 className="text-sm font-medium text-on-surface">
                Spotify Connection
              </h4>

              {!venue?.settings.spotify?.configured ? (
                <p className="text-xs text-on-surface-muted">
                  Add credentials above before connecting an account.
                </p>
              ) : spotifyStatus?.connected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm text-on-surface">
                      Connected as <strong>{spotifyStatus.displayName}</strong>
                    </span>
                    {spotifyStatus.isPremium && (
                      <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      setSpotifyLoading(true);
                      try {
                        await disconnectSpotify();
                        setSpotifyStatus({
                          connected: false,
                          spotifyUserId: null,
                          displayName: null,
                          isPremium: false,
                        });
                        showToast("Spotify disconnected", "success");
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to disconnect",
                          "error",
                        );
                      } finally {
                        setSpotifyLoading(false);
                      }
                    }}
                    disabled={spotifyLoading}
                    className="border border-error/50 px-4 py-2 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    {spotifyLoading ? "..." : "Disconnect Spotify"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-on-surface-muted">
                    Connect your Spotify Premium account to enable streaming.
                  </p>
                  <button
                    onClick={async () => {
                      setSpotifyLoading(true);
                      try {
                        const { url } = await getSpotifyAuthUrl();
                        window.location.href = url;
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Failed to get auth URL",
                          "error",
                        );
                        setSpotifyLoading(false);
                      }
                    }}
                    disabled={spotifyLoading}
                    className="bg-[#1DB954] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1ed760] disabled:opacity-50"
                  >
                    {spotifyLoading ? "Connecting..." : "Connect Spotify"}
                  </button>
                </div>
              )}

              <FormToggle
                label="Allow Full Catalog Search"
                description="Let patrons search the entire Spotify catalog (not just your curated library)."
                checked={allowFullCatalogSearch}
                onChange={setAllowFullCatalogSearch}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Default Playlist */}
      <div className="flex flex-col">
        <SectionHeader title="Default Playlist" showTopBorder />
        <DefaultPlaylistConfigSection
          musicSource={musicSource}
          spotifyStatus={spotifyStatus}
          config={defaultPlaylist}
          onChange={handleDefaultPlaylistChange}
          saving={savingDefaultPlaylist}
        />
      </div>

      {/* Display Settings */}
      <div className="flex flex-col">
        <SectionHeader title="Display Settings" showTopBorder />

        <FormSlider
          label="QR Code Size"
          description="Size of the QR code on the Now Playing display (60–300 pixels)."
          value={displayQrSize}
          onChange={setDisplayQrSize}
          min={60}
          max={300}
          step={10}
          formatValue={(v) => `${v}px`}
        />
        <FormToggle
          label="Show Venue Name Header"
          description="Show the top bar with the venue name on the Now Playing display."
          checked={displayShowHeader}
          onChange={setDisplayShowHeader}
        />
        <div className="p-4">
          <p className="text-sm font-medium text-on-surface">Display Theme</p>
          <p className="text-xs text-on-surface-muted">
            Default theme for the Now Playing display and the initial theme for
            new patrons. Existing patrons keep their own choice.
          </p>
          <div className="mt-4 flex flex-wrap">
            {BUILT_IN_THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDisplayTheme(t)}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium border transition-colors ${
                  displayTheme === t
                    ? "bg-primary text-on-primary border-primary"
                    : "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt border-border"
                }`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patron Authentication */}
      <div className="flex flex-col">
        <SectionHeader title="Patron Authentication" showTopBorder />
        <p className="p-4 text-xs text-on-surface-muted">
          Control how new patrons verify when joining. Device ID is always used
          as the base identity.
        </p>

        <FormRadioGroup
          name="otpDeliveryMode"
          options={[
            {
              value: "none" as const,
              label: "No Verification",
              desc: "Patrons join instantly with device ID only.",
            },
            {
              value: "venue-display" as const,
              label: "Venue Display OTP",
              desc: "OTP shown on the Now Playing screen. Proves physical presence.",
            },
            // { value: "sms-gateway" as const, label: "SMS Gateway", desc: "Send OTP via a self-hosted Android SMS gateway." },
            // { value: "paid" as const, label: "Paid SMS (Coming Soon)", desc: "Twilio / cloud SMS provider.", disabled: true },
          ]}
          value={otpDeliveryMode}
          onChange={setOtpDeliveryMode}
        />

        {otpDeliveryMode === "sms-gateway" && (
          <FormInput
            label="SMS Gateway URL"
            description="The HTTP endpoint of your Android SMS Gateway (e.g., http://192.168.1.50:8080/message)"
            type="url"
            value={smsGatewayUrl}
            onChange={setSmsGatewayUrl}
            placeholder="http://192.168.1.50:8080/message"
          />
        )}
      </div>
    </div>
  );
}
