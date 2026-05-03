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
import {
  removeFromQueue,
  playNow,
  reorderQueue,
  getQueueHistory,
} from "../../api/queue";
import { DraggableQueueItem } from "../../components/admin/DraggableQueueItem";
import { timeAgo } from "../../utils/time";
import type { QueueEntry } from "@playplay/shared";
import { Link } from "react-router";

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
    }
  }, [queue, handlePlayNow]);

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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center">
        <h2 className="text-xl font-bold flex-1">Queue Management</h2>
        {/* <div className="flex gap-1">
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-2 text-xs text-on-surface-muted hover:text-on-surface"
          >
            Patron
          </Link>
          <Link
            to="/now-playing"
            className="rounded-md border border-border px-3 py-2 text-xs text-on-surface-muted hover:text-on-surface"
          >
            Now Playing
          </Link>
        </div> */}
      </div>

      {/* Now Playing + Remote Playback Controls */}
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Now Playing
        </h3>
        {nowPlaying ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* Play/Pause button */}
              <button
                onClick={togglePlayPause}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 hover:bg-primary/25 transition-colors"
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
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
              <button
                onClick={handleSkip}
                disabled={queue.length === 0}
                className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium border border-border text-on-surface-muted hover:text-on-surface disabled:opacity-50"
              >
                Skip
              </button>
            </div>
            {/* Progress bar (shows audio owner state) */}
            <div className="flex items-center gap-2">
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
            {audioOwnerDevice && (
              <p className="text-[10px] text-on-surface-muted">
                Audio playing on: {audioOwnerDevice}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-muted">Nothing playing</p>
        )}
      </div>

      {/* Queue */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          Queue ({queue.length})
        </h3>
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
              <div className="space-y-2">
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
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <p className="text-on-surface-muted">Queue is empty</p>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
          History
        </h3>
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entry.song.title}</p>
                  <p className="truncate text-xs text-on-surface-muted">
                    {entry.song.artist}
                    {entry.addedBy && (
                      <span>
                        {" "}
                        ·{" "}
                        {entry.addedBy.avatarEmoji
                          ? entry.addedBy.avatarEmoji + " "
                          : ""}
                        {entry.addedBy.displayName ?? "Default"}
                      </span>
                    )}
                  </p>
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
                <span className="text-xs text-on-surface-muted">
                  {entry.playedAt
                    ? timeAgo(entry.playedAt)
                    : timeAgo(entry.createdAt)}
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
