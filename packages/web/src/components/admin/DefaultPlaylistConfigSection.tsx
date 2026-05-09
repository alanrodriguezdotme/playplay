import { useState } from "react";
import type {
  DefaultPlaylistConfig,
  DefaultPlaylistSourceKind,
  LocalDefaultPlaylistKind,
  MusicSource,
  SpotifyPlaylistSummary,
  SpotifyStatus,
} from "@playplay/shared";
import { FormInput, FormToggle, FormRadioGroup } from "../common/FormFields";
import { validateDefaultPlaylistPath } from "../../api/admin";
import { syncSpotifyDefaultPlaylist } from "../../api/spotify";
import { SpotifyPlaylistPicker } from "./SpotifyPlaylistPicker";

interface Props {
  musicSource: MusicSource;
  spotifyStatus: SpotifyStatus | null;
  config: DefaultPlaylistConfig;
  onChange: (next: DefaultPlaylistConfig) => void;
  saving?: boolean;
}

const SOURCE_OPTIONS_LOCAL = [
  {
    value: "history" as const,
    label: "From History",
    desc: "Replay songs that have been played in this venue before.",
  },
  {
    value: "local" as const,
    label: "Local Files",
    desc: "Pick a folder or .m3u file from the server's file system.",
  },
];

const SOURCE_OPTIONS_SPOTIFY = [
  {
    value: "history" as const,
    label: "From History",
    desc: "Replay songs that have been played in this venue before.",
  },
  {
    value: "spotify" as const,
    label: "Spotify Playlist",
    desc: "Pick from your playlists or search the public catalog.",
  },
];

const LOCAL_KIND_OPTIONS = [
  {
    value: "folder" as const,
    label: "Folder",
    desc: "All audio files inside this folder (recursive).",
  },
  {
    value: "m3u" as const,
    label: ".m3u file",
    desc: "An .m3u or .m3u8 playlist file.",
  },
];

export function DefaultPlaylistConfigSection({
  musicSource,
  spotifyStatus,
  config,
  onChange,
  saving,
}: Props) {
  const sourceOptions =
    musicSource === "spotify" ? SOURCE_OPTIONS_SPOTIFY : SOURCE_OPTIONS_LOCAL;

  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-xs text-on-surface-muted px-4">
        Plays automatically when the queue is empty. Network paths (UNC) are
        supported for local files.
      </p>

      <FormRadioGroup<DefaultPlaylistSourceKind>
        name="defaultPlaylistSource"
        options={sourceOptions}
        value={config.source}
        onChange={(v) => onChange({ ...config, source: v })}
      />
      <div className="flex flex-col gap-4 px-4">
        <FormToggle
          label="Shuffle"
          description="Randomize the order of fallback tracks. When off, plays them in source order and cycles."
          checked={config.shuffle}
          onChange={(v) => onChange({ ...config, shuffle: v })}
          compact
        />

        {config.source === "history" && (
          <HistorySection config={config} onChange={onChange} />
        )}

        {config.source === "local" && (
          <LocalSection config={config} onChange={onChange} saving={saving} />
        )}

        {config.source === "spotify" && (
          <SpotifySection
            config={config}
            onChange={onChange}
            spotifyStatus={spotifyStatus}
          />
        )}
      </div>
    </div>
  );
}

function HistorySection({
  config,
  onChange,
}: {
  config: DefaultPlaylistConfig;
  onChange: (next: DefaultPlaylistConfig) => void;
}) {
  const days = config.history?.lookbackDays ?? "";
  return (
    <div className="border border-border bg-surface-raised p-3">
      <FormInput
        label="Lookback (days)"
        description="Only replay songs played within the last N days. Leave empty for all-time."
        type="number"
        value={days}
        onChange={(v) => {
          const n = parseInt(v, 10);
          onChange({
            ...config,
            history: { lookbackDays: Number.isFinite(n) && n > 0 ? n : null },
          });
        }}
        min={1}
        compact
      />
    </div>
  );
}

function LocalSection({
  config,
  onChange,
  saving,
}: {
  config: DefaultPlaylistConfig;
  onChange: (next: DefaultPlaylistConfig) => void;
  saving?: boolean;
}) {
  const local = config.local ?? {
    kind: "folder" as LocalDefaultPlaylistKind,
    path: "",
  };
  const [pathDraft, setPathDraft] = useState(local.path);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);

  const apply = () => {
    onChange({
      ...config,
      local: { kind: local.kind, path: pathDraft.trim() },
    });
  };

  const validate = async () => {
    setValidating(true);
    setValidationMsg(null);
    setValidationOk(null);
    try {
      const res = await validateDefaultPlaylistPath(local.kind, pathDraft);
      if (res.valid) {
        setValidationOk(true);
        setValidationMsg(`OK · ${res.canonical ?? pathDraft}`);
      } else {
        setValidationOk(false);
        setValidationMsg(res.message ?? "Invalid path");
      }
    } catch (err) {
      setValidationOk(false);
      setValidationMsg(
        err instanceof Error ? err.message : "Validation failed",
      );
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="border border-border bg-surface-raised p-3 space-y-3">
      <FormRadioGroup<LocalDefaultPlaylistKind>
        name="localKind"
        options={LOCAL_KIND_OPTIONS}
        value={local.kind}
        onChange={(v) =>
          onChange({ ...config, local: { kind: v, path: local.path } })
        }
      />
      <div>
        <label className="block text-xs text-on-surface-muted mb-1">
          {local.kind === "folder" ? "Folder path" : ".m3u file path"}
        </label>
        <p className="text-xs text-on-surface-muted mb-2">
          Relative to the music library, an absolute path, or a UNC share like{" "}
          <code className="text-xs">\\server\share\music</code>.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pathDraft}
            onChange={(e) => setPathDraft(e.target.value)}
            placeholder={
              local.kind === "folder"
                ? "./music/default"
                : "./playlists/lounge.m3u"
            }
            className="flex-1 border border-border bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-border-focus focus:outline-none"
          />
          <button
            type="button"
            onClick={validate}
            disabled={validating || pathDraft.trim().length === 0}
            className="border border-border px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface disabled:opacity-50"
          >
            {validating ? "…" : "Validate"}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={saving || pathDraft.trim() === local.path}
            className="border border-primary bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {validationMsg && (
          <p
            className={`mt-2 text-xs ${validationOk ? "text-success" : "text-error"}`}
          >
            {validationMsg}
          </p>
        )}
      </div>
    </div>
  );
}

function SpotifySection({
  config,
  onChange,
  spotifyStatus,
}: {
  config: DefaultPlaylistConfig;
  onChange: (next: DefaultPlaylistConfig) => void;
  spotifyStatus: SpotifyStatus | null;
}) {
  const selected = config.spotify ?? null;
  const [picking, setPicking] = useState(!selected);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  if (!spotifyStatus?.connected) {
    return (
      <div className="border border-border bg-surface-raised p-3 text-xs text-on-surface-muted">
        Connect Spotify above to choose a default playlist.
      </div>
    );
  }

  const handleSelect = (p: SpotifyPlaylistSummary) => {
    onChange({
      ...config,
      spotify: {
        playlistId: p.id,
        playlistName: p.name,
        ownerName: p.ownerName,
        trackCount: p.trackCount,
        lastSyncedAt: null,
      },
    });
    setPicking(false);
    setSyncMsg(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncSpotifyDefaultPlaylist();
      onChange({ ...config, spotify: res.spotify });
      setSyncMsg(
        `Synced ${res.trackCount} tracks${res.errors.length ? ` (${res.errors.length} skipped)` : ""}`,
      );
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-border bg-surface-raised p-3 space-y-3">
      {selected && !picking ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-on-surface">
                {selected.playlistName}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                by {selected.ownerName} · {selected.trackCount} tracks
              </p>
              {selected.lastSyncedAt && (
                <p className="text-xs text-on-surface-subtle mt-1">
                  Last synced {new Date(selected.lastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="border border-border px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="border border-border px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface"
              >
                Change
              </button>
            </div>
          </div>
          {syncMsg && (
            <p className="text-xs text-on-surface-muted">{syncMsg}</p>
          )}
        </div>
      ) : (
        <SpotifyPlaylistPicker
          selectedId={selected?.playlistId ?? null}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
