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
  const [allowFullCatalogSearch, setAllowFullCatalogSearch] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(
    null,
  );
  const [spotifyLoading, setSpotifyLoading] = useState(false);

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
      setAllowFullCatalogSearch(data.settings.allowFullCatalogSearch);
      // Fetch Spotify status
      try {
        const status = await getSpotifyStatus();
        setSpotifyStatus(status);
      } catch {
        // Spotify not configured — ignore
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
          {musicSource === "spotify" && (
            <div className="space-y-3 p-4">
              <h4 className="text-sm font-medium text-on-surface">
                Spotify Connection
              </h4>

              {spotifyStatus?.connected ? (
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
