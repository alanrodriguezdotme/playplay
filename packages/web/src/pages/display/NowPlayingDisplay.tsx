import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router";
import type {
  QueueEntry,
  QueueResponse,
  DisplaySettings,
} from "@playplay/shared";
import { DEFAULTS, SOCKET_EVENTS } from "@playplay/shared";
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
import { DisplayVenueOtp } from "./components/DisplayVenueOtp";

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
    lanIp: null,
  });

  // Venue OTP overlay state
  const [venueOtp, setVenueOtp] = useState<{
    code: string;
    deviceHint: string;
  } | null>(null);

  // Listen for venue OTP socket events
  useEffect(() => {
    if (!socket) return;

    const handleShow = (data: { code: string; deviceHint: string }) => {
      setVenueOtp(data);
    };
    const handleHide = () => {
      setVenueOtp(null);
    };

    socket.on(SOCKET_EVENTS.VENUE_OTP_SHOW, handleShow);
    socket.on(SOCKET_EVENTS.VENUE_OTP_HIDE, handleHide);

    return () => {
      socket.off(SOCKET_EVENTS.VENUE_OTP_SHOW, handleShow);
      socket.off(SOCKET_EVENTS.VENUE_OTP_HIDE, handleHide);
    };
  }, [socket]);

  // Fetch display settings
  useEffect(() => {
    if (!slug) return;
    getDisplaySettings(slug)
      .then(setDisplaySettings)
      .catch(() => { });
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
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        {/* Left / Top: Now Playing + QR */}
        <div className="flex shrink-0 flex-col landscape:flex-1 landscape:min-h-0">
          <div className="flex flex-1 items-center justify-center p-6 landscape:min-h-0 landscape:overflow-auto">
            <DisplayNowPlaying entry={nowPlaying} />
          </div>
        </div>

        {/* Right / Bottom: Queue + History */}
        <div className="flex min-h-0 flex-1 flex-col border-t landscape:border-l landscape:border-t-0 border-border overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DisplayQueue queue={queue} />
          </div>
          <div className="shrink-0 border-t border-border">
            <DisplayHistory entries={recentHistory} />
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            <DisplayQRCode
              venueSlug={slug}
              size={displaySettings.displayQrSize}
              lanIp={displaySettings.lanIp}
            />
          </div>
        </div>
      </div>

      {venueOtp && (
        <DisplayVenueOtp
          code={venueOtp.code}
          deviceHint={venueOtp.deviceHint}
          onExpired={() => setVenueOtp(null)}
        />
      )}
    </div>
  );
}
