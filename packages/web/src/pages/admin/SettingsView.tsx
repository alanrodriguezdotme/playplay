import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { useToast } from "../../contexts/ToastContext";
import { useTheme, BUILT_IN_THEMES } from "../../contexts/ThemeContext";
import { getVenue, updateVenueSettings } from "../../api/admin";
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
} from "@playplay/shared";
import SectionHeader from "../../components/common/SectionHeader";

export function SettingsView() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [venue, setVenue] = useState<AdminVenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [voteThreshold, setVoteThreshold] = useState(-5);
  const [maxSongsPerUser, setMaxSongsPerUser] = useState(3);
  const [defaultPlaylistPath, setDefaultPlaylistPath] = useState("");
  const [displayQrSize, setDisplayQrSize] = useState(120);
  const [displayShowHeader, setDisplayShowHeader] = useState(true);
  const [otpDeliveryMode, setOtpDeliveryMode] =
    useState<OtpDeliveryMode>("none");
  const [smsGatewayUrl, setSmsGatewayUrl] = useState("");
  const [musicSource, setMusicSource] = useState<MusicSource>("local");
  const [allowFullCatalogSearch, setAllowFullCatalogSearch] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(
    null,
  );
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const fetchVenue = useCallback(async () => {
    try {
      const data = await getVenue();
      setVenue(data);
      setVoteThreshold(data.settings.voteThreshold);
      setMaxSongsPerUser(data.settings.maxSongsPerUser);
      setDefaultPlaylistPath(data.settings.defaultPlaylistPath);
      setDisplayQrSize(data.settings.displayQrSize);
      setDisplayShowHeader(data.settings.displayShowHeader);
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
    }
  }, [showToast]);

  useEffect(() => {
    fetchVenue();
  }, [fetchVenue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: AdminVenueSettingsUpdateBody = {
        voteThreshold,
        maxSongsPerUser,
        defaultPlaylistPath,
        displayQrSize,
        displayShowHeader,
        otpDeliveryMode,
        smsGatewayUrl,
        musicSource,
        allowFullCatalogSearch,
      };
      const updated = await updateVenueSettings(body);
      setVenue(updated);
      showToast("Settings saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

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

      {/* Venue Info (read-only) */}
      {venue && (
        <div className="flex flex-col">
          <SectionHeader title="Venue Info" showTopBorder />
          <div className="grid gap-4 sm:grid-cols-2 p-4">
            <div>
              <p className="text-xs text-on-surface-muted">Name</p>
              <p className="text-sm font-medium">{venue.name}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-muted">Slug</p>
              <p className="text-sm font-medium">{venue.slug}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-muted">Email</p>
              <p className="text-sm font-medium">{venue.email}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-muted">Phone</p>
              <p className="text-sm font-medium">{venue.phone}</p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Settings */}
      <div className="flex flex-col">
        <SectionHeader title="Queue Settings" showTopBorder />

        <div className="p-4">
          <label className="block text-sm font-medium text-on-surface mb-1">
            Vote Threshold
          </label>
          <p className="text-xs text-on-surface-muted mb-2">
            Songs with a vote score at or below this value are automatically
            removed.
          </p>
          <input
            type="number"
            value={voteThreshold}
            onChange={(e) => setVoteThreshold(parseInt(e.target.value) || 0)}
            max={0}
            className="w-full border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
          />
        </div>

        <div className="p-4">
          <label className="block text-sm font-medium text-on-surface mb-1">
            Max Songs Per User
          </label>
          <p className="text-xs text-on-surface-muted mb-2">
            Maximum number of songs a patron can have in the queue at once.
          </p>
          <input
            type="number"
            value={maxSongsPerUser}
            onChange={(e) =>
              setMaxSongsPerUser(Math.max(1, parseInt(e.target.value) || 1))
            }
            min={1}
            className="w-full border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
          />
        </div>

        <div className="p-4">
          <label className="block text-sm font-medium text-on-surface mb-1">
            Default Playlist Path
          </label>
          <p className="text-xs text-on-surface-muted mb-2">
            Relative path to the folder of songs that play when the queue is
            empty.
          </p>
          <input
            type="text"
            value={defaultPlaylistPath}
            onChange={(e) => setDefaultPlaylistPath(e.target.value)}
            placeholder="./music/default"
            className="w-full border border-border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
          />
        </div>
        <div className="p-4 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Display Settings */}
      <div className="flex flex-col">
        <SectionHeader title="Music Source" showTopBorder />
        <p className="p-4 text-xs text-on-surface-muted">
          Choose where songs come from. You can switch between local files and
          Spotify at any time.
        </p>

        <div className="px-4 space-y-4">
          {(
            [
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
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 border p-3 transition-colors ${
                musicSource === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="musicSource"
                value={opt.value}
                checked={musicSource === opt.value}
                onChange={() => setMusicSource(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-on-surface">
                  {opt.label}
                </p>
                <p className="text-xs text-on-surface-muted">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {musicSource === "spotify" && (
          <div className="space-y-3 border border-border bg-surface-raised p-4 pl-9 mx-4">
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

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-on-surface">
                  Allow Full Catalog Search
                </label>
                <p className="text-xs text-on-surface-muted">
                  Let patrons search the entire Spotify catalog (not just your
                  curated library).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowFullCatalogSearch}
                onClick={() =>
                  setAllowFullCatalogSearch(!allowFullCatalogSearch)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  allowFullCatalogSearch ? "bg-primary" : "bg-surface-alt"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    allowFullCatalogSearch ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <div className="p-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Display Settings */}
      <div className="flex flex-col">
        <SectionHeader title="Display Settings" showTopBorder />

        <div className="p-4">
          <label className="block text-sm font-medium text-on-surface mb-1">
            QR Code Size
          </label>
          <p className="text-xs text-on-surface-muted mb-2">
            Size of the QR code on the Now Playing display (60–300 pixels).
          </p>
          <input
            type="range"
            min={60}
            max={300}
            step={10}
            value={displayQrSize}
            onChange={(e) => setDisplayQrSize(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-xs tabular-nums text-on-surface-muted">
            {displayQrSize}px
          </p>
        </div>

        <div className="flex items-center justify-between p-4">
          <div>
            <label className="block text-sm font-medium text-on-surface">
              Show Venue Name Header
            </label>
            <p className="text-xs text-on-surface-muted">
              Show the top bar with the venue name on the Now Playing display.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={displayShowHeader}
            onClick={() => setDisplayShowHeader(!displayShowHeader)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              displayShowHeader ? "bg-primary" : "bg-surface-alt"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                displayShowHeader ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Patron Authentication */}
      <div className="flex flex-col">
        <SectionHeader title="Patron Authentication" showTopBorder />
        <p className="p-4 text-xs text-on-surface-muted">
          Control how new patrons verify when joining. Device ID is always used
          as the base identity.
        </p>

        <div className="px-4 space-y-4">
          {(
            [
              {
                value: "none" as const,
                label: "No Verification",
                desc: "Patrons join instantly with device ID only.",
                disabled: false,
              },
              {
                value: "venue-display" as const,
                label: "Venue Display OTP",
                desc: "OTP shown on the Now Playing screen. Proves physical presence.",
                disabled: false,
              },
              // {
              //   value: "sms-gateway" as const,
              //   label: "SMS Gateway",
              //   desc: "Send OTP via a self-hosted Android SMS gateway.",
              //   disabled: false,
              // },
              // {
              //   value: "paid" as const,
              //   label: "Paid SMS (Coming Soon)",
              //   desc: "Twilio / cloud SMS provider.",
              //   disabled: true,
              // },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 border p-3 transition-colors ${
                otpDeliveryMode === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border"
              } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="otpDeliveryMode"
                value={opt.value}
                checked={otpDeliveryMode === opt.value}
                onChange={() => setOtpDeliveryMode(opt.value)}
                disabled={opt.disabled}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-on-surface">
                  {opt.label}
                  {opt.disabled && (
                    <span className="ml-2 rounded bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-muted">
                      COMING SOON
                    </span>
                  )}
                </p>
                <p className="text-xs text-on-surface-muted">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {otpDeliveryMode === "sms-gateway" && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">
              SMS Gateway URL
            </label>
            <p className="text-xs text-on-surface-muted mb-2">
              The HTTP endpoint of your Android SMS Gateway (e.g.,
              http://192.168.1.50:8080/message)
            </p>
            <input
              type="url"
              value={smsGatewayUrl}
              onChange={(e) => setSmsGatewayUrl(e.target.value)}
              placeholder="http://192.168.1.50:8080/message"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
            />
          </div>
        )}

        <div className="p-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
