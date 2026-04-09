import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useTheme, BUILT_IN_THEMES } from "../../contexts/ThemeContext";
import { getVenue, updateVenueSettings } from "../../api/admin";
import type {
  AdminVenueResponse,
  AdminVenueSettingsUpdateBody,
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

  const fetchVenue = useCallback(async () => {
    try {
      const data = await getVenue();
      setVenue(data);
      setVoteThreshold(data.settings.voteThreshold);
      setMaxSongsPerUser(data.settings.maxSongsPerUser);
      setDefaultPlaylistPath(data.settings.defaultPlaylistPath);
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
