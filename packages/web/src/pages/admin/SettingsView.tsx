import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useTheme, BUILT_IN_THEMES } from "../../contexts/ThemeContext";
import { getVenue, updateVenueSettings } from "../../api/admin";
import type {
  AdminVenueResponse,
  AdminVenueSettingsUpdateBody,
  OtpDeliveryMode,
} from "@playplay/shared";

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
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* Venue Info (read-only) */}
      {venue && (
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
            Venue Info
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Queue Settings
        </h3>

        <div>
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
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
          />
        </div>

        <div>
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
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
          />
        </div>

        <div>
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
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Display Settings */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Display Settings
        </h3>

        <div>
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

        <div className="flex items-center justify-between">
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

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Patron Authentication */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Patron Authentication
        </h3>
        <p className="text-xs text-on-surface-muted">
          Control how new patrons verify when joining. Device ID is always used
          as the base identity.
        </p>

        <div className="space-y-2">
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
              {
                value: "sms-gateway" as const,
                label: "SMS Gateway",
                desc: "Send OTP via a self-hosted Android SMS gateway.",
                disabled: false,
              },
              {
                value: "paid" as const,
                label: "Paid SMS (Coming Soon)",
                desc: "Twilio / cloud SMS provider.",
                disabled: true,
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
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

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Theme */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Theme
        </h3>
        <p className="text-xs text-on-surface-muted">
          Choose a color theme for the venue. This applies to all views.
        </p>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN_THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                theme === t
                  ? "bg-primary text-on-primary"
                  : "border border-border text-on-surface-muted hover:text-on-surface hover:bg-surface-alt"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
