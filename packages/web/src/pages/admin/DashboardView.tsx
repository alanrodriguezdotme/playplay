import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { getAdminStats } from "../../api/admin";
import { useQueue } from "../../contexts/QueueContext";
import { timeAgo } from "../../utils/time";
import type { AdminStatsResponse } from "@playplay/shared";
import SectionHeader from "../../components/common/SectionHeader";

function StatCard({
  label,
  value,
  showBottomBorder,
}: {
  label: string;
  value: number | string;
  showBottomBorder?: boolean;
}) {
  return (
    <div
      className={`bg-surface-alt p-4 ${showBottomBorder ? "border-b border-border" : ""}`}
    >
      <p className="text-xs font-medium text-on-surface-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl text-primary font-bold text-on-surface font-family-accent">
        {value}
      </p>
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
      <div className="grid grid-cols-2 gap-0 md:grid-cols-4 divide-x-1 divide-border border-b-0">
        <StatCard
          label="Total Songs"
          value={stats?.totalUnblockedSongs ?? 0}
          showBottomBorder
        />
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          showBottomBorder
        />
        <StatCard
          label="In Queue"
          value={stats?.totalQueued ?? 0}
          showBottomBorder
        />
        <StatCard
          label="Played Today"
          value={stats?.totalPlayed ?? 0}
          showBottomBorder
        />
      </div>

      {/* Now Playing */}
      <div>
        <SectionHeader title="Now Playing" />
        {nowPlaying ? (
          <div className="flex items-center gap-3 p-4 pt-2">
            {/* <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Play
                fill="currentColor"
                stroke="none"
                className="h-5 w-5 text-primary"
              />
            </div> */}
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="truncate text-lg font-semibold font-family-accent">
                {nowPlaying.song.title}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {nowPlaying.song.artist}
              </p>
              <p className="truncate text-xs text-on-surface-muted">
                {nowPlaying.addedBy?.avatarEmoji
                  ? nowPlaying.addedBy.avatarEmoji + " "
                  : ""}
                {nowPlaying.addedBy?.displayName ?? "Default playlist"}
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
      <div>
        <SectionHeader title={`Up Next (${queue.length})`} />
        {queue.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {queue.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 p-4">
                <span className="w-5 text-center text-xs font-medium text-on-surface-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-md font-family-accent">
                    {entry.song.title}
                  </p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {entry.song.artist}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-md font-medium font-family-accent">
                    {entry.voteScore > 0 ? "+" : ""}
                    {entry.voteScore}
                  </div>
                  <span className="text-xs text-on-surface-subtle uppercase">
                    VOTES
                  </span>
                </div>
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
        <div>
          <SectionHeader title="Top Songs" />
          <div className="flex flex-col gap-1 divide-y divide-border">
            {stats.topSongs.map((song, i) => (
              <div key={song.id} className="flex items-center gap-3 p-4">
                <span className="w-5 text-center text-xs font-medium text-on-surface-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p className="truncate text-md font-family-accent">
                    {song.title}
                  </p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {song.artist}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-md font-medium font-family-accent">
                    {song.totalPlays}
                  </div>
                  <span className="text-xs text-on-surface-subtle uppercase">
                    plays
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div>
          <SectionHeader title="Recent Activity" />
          <div className="flex flex-col divide-y divide-border">
            {stats.recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p className="truncate text-md font-family-accent">
                    {entry.song.title}
                  </p>
                  <span className="text-xs text-on-surface-muted">
                    {entry.song.artist}
                  </span>
                  <p className="text-xs text-on-surface-muted">
                    {entry.addedBy?.avatarEmoji
                      ? entry.addedBy.avatarEmoji + " "
                      : ""}
                    {entry.addedBy?.displayName ?? "Default playlist"} ·{" "}
                    <span className="uppercase font-semibold text-on-surface-subtle">
                      {timeAgo(entry.createdAt)}
                    </span>
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
