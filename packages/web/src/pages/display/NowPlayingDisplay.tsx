import { useState, useCallback, useRef, useEffect } from "react";
import type {
  QueueEntry,
  QueueResponse,
  DisplaySettings,
} from "@playplay/shared";
import { DEFAULTS } from "@playplay/shared";
import { useQueueUpdates } from "../../hooks/useSocket";
import { useVenue } from "../../contexts/VenueContext";
import { BUILT_IN_THEMES, loadThemeFont } from "../../contexts/ThemeContext";
import type { BuiltInTheme } from "../../contexts/ThemeContext";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useWakeLock } from "../../hooks/useWakeLock";
import { getDisplaySettings, getQueueHistory } from "../../api/queue";
import { DisplayHeader } from "./components/DisplayHeader";
import { DisplayNowPlaying } from "./components/DisplayNowPlaying";
import { DisplayQueue } from "./components/DisplayQueue";
import { DisplayHistory } from "./components/DisplayHistory";
import { DisplayQRCode } from "./components/DisplayQRCode";

const MAX_HISTORY = 20;

export function NowPlayingDisplay() {
  const { venue } = useVenue();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  useWakeLock();

  const [nowPlaying, setNowPlaying] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [recentHistory, setRecentHistory] = useState<QueueEntry[]>([]);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    displayQrSize: DEFAULTS.DISPLAY_QR_SIZE,
    displayShowHeader: DEFAULTS.DISPLAY_SHOW_HEADER,
    displayTheme: DEFAULTS.DISPLAY_THEME,
    lanIp: null,
  });

  // Fetch display settings
  useEffect(() => {
    getDisplaySettings()
      .then(setDisplaySettings)
      .catch(() => {});
  }, []);

  // Apply the venue's display theme to the document WITHOUT touching
  // localStorage — the display is its own surface and shouldn't change
  // the theme of admin/patron tabs in the same browser.
  useEffect(() => {
    const t = displaySettings.displayTheme;
    if (!t || !(BUILT_IN_THEMES as readonly string[]).includes(t)) return;
    const root = document.documentElement;
    if (t === "dark") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", t);
    }
    loadThemeFont(t as BuiltInTheme);
    return () => {
      // On unmount, hand control back to the patron/admin theme stored
      // in localStorage (handled by ThemeProvider on next mount).
      root.removeAttribute("data-theme");
    };
  }, [displaySettings.displayTheme]);

  // Track the last now-playing ID to detect transitions for history
  const lastNowPlayingIdRef = useRef<string | null>(null);

  const refreshHistory = useCallback(() => {
    getQueueHistory(1, MAX_HISTORY)
      .then((res) => setRecentHistory(res.entries))
      .catch(() => {});
  }, []);

  // Initial history load
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const onQueueUpdated = useCallback(
    (data: QueueResponse) => {
      setQueue(data.queue);

      const prevId = lastNowPlayingIdRef.current;
      const newId = data.nowPlaying?.id ?? null;
      if (prevId && prevId !== newId) {
        refreshHistory();
      }

      setNowPlaying(data.nowPlaying);
      lastNowPlayingIdRef.current = newId;
    },
    [refreshHistory],
  );

  const onNowPlayingChanged = useCallback(
    (entry: QueueEntry | null) => {
      const prevId = lastNowPlayingIdRef.current;
      const newId = entry?.id ?? null;
      if (prevId && prevId !== newId) {
        refreshHistory();
      }

      setNowPlaying(entry);
      lastNowPlayingIdRef.current = newId;
    },
    [refreshHistory],
  );

  const onEntryAdded = useCallback((entry: QueueEntry) => {
    setQueue((prev) => [...prev, entry]);
  }, []);

  const onEntryRemoved = useCallback((entryId: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  useQueueUpdates({
    onQueueUpdated,
    onNowPlayingChanged,
    onEntryAdded,
    onEntryRemoved,
  });

  if (!venue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
        <p className="text-xl text-on-surface-muted">Loading venue...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
      <DisplayHeader
        venueName={venue.name}
        isFullscreen={isFullscreen}
        show={displaySettings.displayShowHeader}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Responsive grid: single column portrait, two columns landscape */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        {/* Left / Top: Now Playing + QR */}
        <div className="flex shrink-0 flex-col landscape:flex-1 landscape:max-w-1/2 landscape:min-h-0">
          <div className="flex flex-1 items-center justify-center p-6 landscape:min-h-0 landscape:overflow-auto">
            <DisplayNowPlaying entry={nowPlaying} />
          </div>
          <div className="hidden landscape:flex w-full justify-center px-6 py-4">
            <DisplayQRCode
              size={displaySettings.displayQrSize}
              lanIp={displaySettings.lanIp}
            />
          </div>
        </div>

        {/* Right / Bottom: Queue + History */}
        <div className="flex min-h-0 flex-1 flex-col border-t landscape:border-l landscape:border-t-0 border-border overflow-hidden">
          <div className="flex min-h-0 flex-col shrink-0">
            <DisplayQueue queue={queue} />
          </div>
          <div className="flex-1 border-t border-border overflow-hidden">
            <DisplayHistory entries={recentHistory} />
          </div>
          <div className="landscape:hidden fixed bottom-4 right-4 bg-surface-alt shrink-0 border border-border px-6 py-4 flex items-center justify-center">
            <DisplayQRCode
              size={displaySettings.displayQrSize}
              lanIp={displaySettings.lanIp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
