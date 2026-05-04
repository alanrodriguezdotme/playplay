import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { getAdminStats } from "../../api/admin";
import { useQueue } from "../../contexts/QueueContext";
import { timeAgo } from "../../utils/time";
import type { AdminStatsResponse } from "@playplay/shared";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface-raised p-4">
      <p className="text-xs font-medium text-on-surface-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DashboardView() {
  const { nowPlaying, queue } = useQueue();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-on-surface-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button onClick={fetchStats} className="ml-2 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-border divide-y-1">
      <AdminPageHeader title="Dashboard" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-0 md:grid-cols-4 divide-solid divide-x-1 divide-border">
        <StatCard label="Total Songs" value={stats?.totalUnblockedSongs ?? 0} />
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="In Queue" value={stats?.totalQueued ?? 0} />
        <StatCard label="Played Today" value={stats?.totalPlayed ?? 0} />
      </div>

      {/* Now Playing */}
      <div className="bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Now Playing
        </h3>
        {nowPlaying ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Play
                fill="currentColor"
                stroke="none"
                className="h-5 w-5 text-primary"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {nowPlaying.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {nowPlaying.song.artist}
              </p>
            </div>
            <div className="text-xs text-on-surface-muted">
              {formatDuration(nowPlaying.song.duration)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-muted">Nothing playing</p>
        )}
      </div>

      {/* Queue Preview */}
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Up Next ({queue.length})
        </h3>
        {queue.length > 0 ? (
          <div className="space-y-2">
            {queue.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-medium text-on-surface-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entry.song.title}</p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {entry.song.artist}
                  </p>
                </div>
                <span className="text-xs text-on-surface-muted">
                  {entry.voteScore > 0 ? "+" : ""}
                  {entry.voteScore}
                </span>
              </div>
            ))}
            {queue.length > 5 && (
              <p className="text-xs text-on-surface-muted">
                +{queue.length - 5} more in queue
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-muted">Queue is empty</p>
        )}
      </div>

      {/* Top Songs */}
      {stats?.topSongs && stats.topSongs.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
            Top Songs
          </h3>
          <div className="space-y-2">
            {stats.topSongs.map((song, i) => (
              <div key={song.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-medium text-on-surface-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{song.title}</p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {song.artist}
                  </p>
                </div>
                <span className="text-xs text-on-surface-muted">
                  {song.totalPlays} plays
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {stats.recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    entry.status === "PLAYING"
                      ? "bg-success"
                      : entry.status === "QUEUED"
                        ? "bg-primary"
                        : entry.status === "PLAYED"
                          ? "bg-on-surface-muted"
                          : "bg-destructive"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {entry.song.title}
                    <span className="text-on-surface-muted">
                      {" "}
                      — {entry.song.artist}
                    </span>
                  </p>
                  <p className="text-xs text-on-surface-muted">
                    {entry.addedBy?.avatarEmoji
                      ? entry.addedBy.avatarEmoji + " "
                      : ""}
                    {entry.addedBy?.displayName ?? "Default playlist"} ·{" "}
                    {timeAgo(entry.createdAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    entry.status === "PLAYING"
                      ? "bg-success/15 text-success"
                      : entry.status === "QUEUED"
                        ? "bg-primary/15 text-primary"
                        : entry.status === "PLAYED"
                          ? "bg-on-surface-muted/15 text-on-surface-muted"
                          : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
