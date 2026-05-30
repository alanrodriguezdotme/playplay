import { useCallback, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useQueue } from "../../contexts/QueueContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../hooks/useSocket";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { PlaybackSyncState } from "@playplay/shared";
import { Button } from "../../components/common/Button";
import {
  removeFromQueue,
  playNow,
  reorderQueue,
  getQueueHistory,
} from "../../api/queue";
import { DraggableQueueItem } from "../../components/admin/DraggableQueueItem";
import { timeAgo } from "../../utils/time";
import type { QueueEntry } from "@playplay/shared";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import SectionHeader from "../../components/common/SectionHeader";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QueueManagement() {
  const { nowPlaying, queue, refresh } = useQueue();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Remote playback state (from audio owner via PLAYBACK_SYNC)
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncedTime, setSyncedTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioOwnerDevice, setAudioOwnerDevice] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState(0);

  // Listen for playback sync from server
  useEffect(() => {
    if (!socket) return;

    const onSync = (state: PlaybackSyncState) => {
      setIsPlaying(state.isPlaying);
      setSyncedTime(state.currentTime);
      setDuration(state.duration);
      setAudioOwnerDevice(state.audioOwnerDeviceHint);
    };

    socket.on(SOCKET_EVENTS.PLAYBACK_SYNC, onSync);
    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_SYNC, onSync);
    };
  }, [socket]);

  // Sync localTime from server
  useEffect(() => {
    setLocalTime(syncedTime);
  }, [syncedTime]);

  // Reset on song change
  useEffect(() => {
    setLocalTime(0);
  }, [nowPlaying?.song?.id]);

  // Interpolate localTime while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setLocalTime((prev) => {
        const next = prev + 0.25;
        return duration > 0 ? Math.min(next, duration) : next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Reset state when nothing is playing
  useEffect(() => {
    if (!nowPlaying) {
      setIsPlaying(false);
      setSyncedTime(0);
      setLocalTime(0);
      setDuration(0);
    }
  }, [nowPlaying]);

  const togglePlayPause = useCallback(() => {
    if (!socket) return;
    if (isPlaying) {
      socket.emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
    } else {
      socket.emit(SOCKET_EVENTS.PLAYBACK_PLAY);
    }
  }, [socket, isPlaying]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchHistory = useCallback(
    async (page: number, append = false) => {
      setHistoryLoading(true);
      try {
        const data = await getQueueHistory(page, 20);
        setHistory((prev) =>
          append ? [...prev, ...data.entries] : data.entries,
        );
        setHistoryTotal(data.total);
        setHistoryPage(page);
      } catch {
        showToast("Failed to load history", "error");
      } finally {
        setHistoryLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleRemove = useCallback(
    async (entryId: string) => {
      try {
        await removeFromQueue(entryId);
        showToast("Removed from queue", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to remove",
          "error",
        );
      }
    },
    [showToast],
  );

  const handlePlayNow = useCallback(
    async (entryId: string) => {
      try {
        await playNow(entryId);
        showToast("Playing now", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to play",
          "error",
        );
      }
    },
    [showToast],
  );

  const handleSkip = useCallback(async () => {
    if (queue.length > 0) {
      await handlePlayNow(queue[0].id);
      return;
    }
    if (nowPlaying && socket) {
      socket.emit(SOCKET_EVENTS.PLAYBACK_ENDED);
    }
  }, [queue, nowPlaying, socket, handlePlayNow]);

  const handleStop = useCallback(() => {
    if (nowPlaying && socket) {
      socket.emit(SOCKET_EVENTS.PLAYBACK_STOP);
    }
  }, [nowPlaying, socket]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = queue.findIndex((e) => e.id === active.id);
      const newIndex = queue.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(queue, oldIndex, newIndex);
      try {
        await reorderQueue(newOrder.map((e) => e.id));
        showToast("Queue reordered", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to reorder",
          "error",
        );
        refresh();
      }
    },
    [queue, refresh, showToast],
  );

  return (
    <div className="flex flex-col">
      <AdminPageHeader title="Queue Management" />

      {/* Now Playing + Remote Playback Controls */}
      <div className="bg-surface-raised flex flex-col">
        <SectionHeader
          title="Now Playing"
          subtitle={
            audioOwnerDevice && (
              <p className="text-[10px] text-on-surface-muted">
                Audio: {audioOwnerDevice}
              </p>
            )
          }
        />
        {nowPlaying ? (
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center gap-3 p-4 pb-2">
              {/* Play/Pause button */}
              <button
                onClick={togglePlayPause}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 hover:bg-primary/25 transition-colors"
              >
                {isPlaying ? (
                  <Pause
                    fill="currentColor"
                    stroke="none"
                    className="h-5 w-5 text-primary"
                  />
                ) : (
                  <Play
                    fill="currentColor"
                    stroke="none"
                    className="h-5 w-5 text-primary"
                  />
                )}
              </button>
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <p className="truncate text-md font-family-accent">
                  {nowPlaying.song.title}
                </p>
                <p className="truncate text-xs text-on-surface-muted">
                  {nowPlaying.song.artist}
                  {nowPlaying.addedBy && (
                    <span>
                      {" "}
                      ·{" "}
                      {nowPlaying.addedBy.avatarEmoji
                        ? nowPlaying.addedBy.avatarEmoji + " "
                        : ""}
                      {nowPlaying.addedBy.displayName ?? "Unknown"}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleStop}
                disabled={!nowPlaying}
                className="bg-surface"
              >
                Stop
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleSkip}
                disabled={queue.length === 0 && !nowPlaying}
                className="bg-surface"
              >
                Skip
              </Button>
            </div>
            {/* Progress bar (shows audio owner state) */}
            <div className="flex items-center gap-2 p-4 pt-2">
              <span className="text-[10px] tabular-nums text-on-surface-muted w-10 text-right">
                {formatDuration(Math.floor(localTime))}
              </span>
              <div className="h-1 flex-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: duration ? `${(localTime / duration) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-on-surface-muted w-10">
                {formatDuration(Math.floor(duration))}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 pt-2">
            <p className="text-sm text-on-surface-muted">Nothing playing</p>
          </div>
        )}
      </div>

      {/* Queue */}
      <div>
        <SectionHeader title={`Queue (${queue.length})`} showTopBorder />
        {queue.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={queue.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col divide-y divide-border">
                {queue.map((entry) => (
                  <DraggableQueueItem
                    key={entry.id}
                    entry={entry}
                    onRemove={handleRemove}
                    onPlayNow={handlePlayNow}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="p-8 w-full text-center">
            <p className="text-on-surface-subtle">Queue is empty</p>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <SectionHeader title="History" showTopBorder />
        {history.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 p-4">
                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <p className="truncate text-sm font-family-accent">
                    {entry.song.title}
                  </p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {entry.song.artist} · {entry.song.album}
                  </p>
                  <div className="flex gap-1">
                    {entry.addedBy && (
                      <span className="text-xs text-on-surface-subtle">
                        {entry.addedBy.avatarEmoji
                          ? entry.addedBy.avatarEmoji + " "
                          : ""}
                        {entry.addedBy.displayName ?? "Unknown"}
                      </span>
                    )}
                    <span className="text-xs text-on-surface-subtle">·</span>
                    <span
                      className={`text-xs font-semibold text-on-surface-subtle uppercase`}
                    >
                      {entry.voteScore} votes
                    </span>
                    <span className="text-xs text-on-surface-subtle">·</span>
                    <span className={`text-xs text-on-surface-subtle`}>
                      {entry.playedAt
                        ? timeAgo(entry.playedAt)
                        : timeAgo(entry.createdAt)}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    entry.status === "PLAYED"
                      ? "bg-on-surface-muted/15 text-on-surface-muted"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            ))}
            {history.length < historyTotal && (
              <button
                onClick={() => fetchHistory(historyPage + 1, true)}
                disabled={historyLoading}
                className="w-full rounded-lg border border-border py-2 text-xs font-medium text-on-surface-muted hover:text-on-surface disabled:opacity-50"
              >
                {historyLoading
                  ? "Loading..."
                  : `Load More (${history.length} of ${historyTotal})`}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <p className="text-on-surface-muted">No history yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
