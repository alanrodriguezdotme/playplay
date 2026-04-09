import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router";
import type {
  QueueEntry,
  QueueResponse,
  DisplaySettings,
} from "@playplay/shared";
import { DEFAULTS } from "@playplay/shared";
import { useQueueUpdates } from "../../hooks/useSocket";
import { useSocketContext } from "../../contexts/SocketContext";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useWakeLock } from "../../hooks/useWakeLock";
import { getDisplaySettings } from "../../api/queue";
import { DisplayHeader } from "./components/DisplayHeader";
import { DisplayNowPlaying } from "./components/DisplayNowPlaying";
import { DisplayQueue } from "./components/DisplayQueue";
import { DisplayHistory } from "./components/DisplayHistory";
import { DisplayQRCode } from "./components/DisplayQRCode";
import { DisplayAudioPlayer } from "./components/DisplayAudioPlayer";

const MAX_HISTORY = 10;

export function NowPlayingDisplay() {
  const { slug } = useParams<{ slug: string }>();
  const { socket } = useSocketContext();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  useWakeLock();

  const [nowPlaying, setNowPlaying] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [recentHistory, setRecentHistory] = useState<QueueEntry[]>([]);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    displayQrSize: DEFAULTS.DISPLAY_QR_SIZE,
    displayShowHeader: DEFAULTS.DISPLAY_SHOW_HEADER,
  });

  // Fetch display settings
  useEffect(() => {
    if (!slug) return;
    getDisplaySettings(slug)
      .then(setDisplaySettings)
      .catch(() => {});
  }, [slug]);

  // Track the last now-playing ID to detect transitions for history
  const lastNowPlayingIdRef = useRef<string | null>(null);

  const addToHistory = useCallback((entry: QueueEntry) => {
    setRecentHistory((prev) => {
      // Don't add duplicates
      if (prev.some((e) => e.id === entry.id)) return prev;
      return [entry, ...prev].slice(0, MAX_HISTORY);
    });
  }, []);

  const onQueueUpdated = useCallback(
    (data: QueueResponse) => {
      setQueue(data.queue);

      // If now-playing changed, push old one to history
      const prevId = lastNowPlayingIdRef.current;
      const newId = data.nowPlaying?.id ?? null;
      if (prevId && prevId !== newId && nowPlaying) {
        addToHistory({
          ...nowPlaying,
          status: "PLAYED",
          playedAt: new Date().toISOString(),
        });
      }

      setNowPlaying(data.nowPlaying);
      lastNowPlayingIdRef.current = newId;
    },
    [nowPlaying, addToHistory],
  );

  const onNowPlayingChanged = useCallback(
    (entry: QueueEntry | null) => {
      const prevId = lastNowPlayingIdRef.current;
      const newId = entry?.id ?? null;
      if (prevId && prevId !== newId && nowPlaying) {
        addToHistory({
          ...nowPlaying,
          status: "PLAYED",
          playedAt: new Date().toISOString(),
        });
      }

      setNowPlaying(entry);
      lastNowPlayingIdRef.current = newId;
    },
    [nowPlaying, addToHistory],
  );

  const onEntryAdded = useCallback((entry: QueueEntry) => {
    setQueue((prev) => [...prev, entry]);
  }, []);

  const onEntryRemoved = useCallback((entryId: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  useQueueUpdates(slug, {
    onQueueUpdated,
    onNowPlayingChanged,
    onEntryAdded,
    onEntryRemoved,
  });

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
        <p className="text-xl text-on-surface-muted">Venue not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
      <DisplayHeader
        venueSlug={slug}
        isFullscreen={isFullscreen}
        show={displaySettings.displayShowHeader}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Responsive grid: single column portrait, two columns landscape */}
      <div className="grid min-h-0 flex-1 grid-cols-1 portrait:grid-rows-[1fr_auto_auto] landscape:grid-cols-2 landscape:grid-rows-1">
        {/* Left / Top: Now Playing + QR */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <div className="flex h-full items-center justify-center">
              <DisplayNowPlaying entry={nowPlaying} />
            </div>
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            <DisplayQRCode
              venueSlug={slug}
              size={displaySettings.displayQrSize}
            />
          </div>
        </div>

        {/* Right / Bottom: Queue + History */}
        <div className="flex min-h-0 flex-col border-t landscape:border-l landscape:border-t-0 border-border">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DisplayQueue queue={queue} />
          </div>
          <div className="shrink-0 border-t border-border">
            <DisplayHistory entries={recentHistory} />
          </div>
        </div>
      </div>

      <DisplayAudioPlayer
        nowPlaying={nowPlaying}
        queueLength={queue.length}
        socket={socket}
      />
    </div>
  );
}
