import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QueueEntry, QueueResponse } from "@playplay/shared";
import { getQueue, addToQueue, voteOnEntry } from "../api/queue";
import { useQueueUpdates } from "../hooks/useSocket";
import { useToast } from "./ToastContext";

interface QueueContextValue {
  queue: QueueEntry[];
  nowPlaying: QueueEntry | null;
  isLoading: boolean;
  error: string | null;
  /** Set of song IDs currently in the queue (for "Already in Queue" checks) */
  queuedSongIds: Set<string>;
  /** Set of Spotify track IDs currently in the queue */
  queuedSpotifyTrackIds: Set<string>;
  vote: (entryId: string, value: 1 | -1 | 0) => Promise<void>;
  addSong: (songId?: string, spotifyTrackId?: string) => Promise<QueueEntry>;
  refresh: () => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({
  venueSlug,
  children,
}: {
  venueSlug: string;
  children: ReactNode;
}) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [nowPlaying, setNowPlaying] = useState<QueueEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue();
      setQueue(data.queue);
      setNowPlaying(data.nowPlaying);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Real-time updates via Socket.IO
  // Broadcasts don't include per-user vote state, so preserve it from current state
  useQueueUpdates(venueSlug, {
    onQueueUpdated: useCallback((data: QueueResponse) => {
      setQueue((prev) => {
        const voteMap = new Map<string, number | null>();
        for (const e of prev) {
          if (e.currentUserVote != null) voteMap.set(e.id, e.currentUserVote);
        }
        return data.queue.map((e) => ({
          ...e,
          currentUserVote: e.currentUserVote ?? voteMap.get(e.id) ?? null,
        }));
      });
      setNowPlaying((prev) => {
        if (!data.nowPlaying) return null;
        return {
          ...data.nowPlaying,
          currentUserVote:
            data.nowPlaying.currentUserVote ?? prev?.currentUserVote ?? null,
        };
      });
    }, []),
    onNowPlayingChanged: useCallback((entry: QueueEntry | null) => {
      setNowPlaying((prev) => {
        if (!entry) return null;
        return {
          ...entry,
          currentUserVote:
            entry.currentUserVote ?? prev?.currentUserVote ?? null,
        };
      });
    }, []),
    onEntryAdded: useCallback((entry: QueueEntry) => {
      setQueue((prev) => [...prev, entry]);
    }, []),
    onEntryRemoved: useCallback((entryId: string) => {
      setQueue((prev) => prev.filter((e) => e.id !== entryId));
    }, []),
  });

  const queuedSongIds = useMemo(() => {
    const ids = new Set<string>();
    if (nowPlaying) ids.add(nowPlaying.song.id);
    for (const entry of queue) {
      ids.add(entry.song.id);
    }
    return ids;
  }, [queue, nowPlaying]);

  const queuedSpotifyTrackIds = useMemo(() => {
    const ids = new Set<string>();
    if (nowPlaying?.song.spotifyTrackId) ids.add(nowPlaying.song.spotifyTrackId);
    for (const entry of queue) {
      if (entry.song.spotifyTrackId) ids.add(entry.song.spotifyTrackId);
    }
    return ids;
  }, [queue, nowPlaying]);

  const vote = useCallback(
    async (entryId: string, value: 1 | -1 | 0) => {
      // Optimistically update local state
      const applyVote = (entry: QueueEntry): QueueEntry => {
        if (entry.id !== entryId) return entry;
        const oldVote = entry.currentUserVote ?? 0;
        const newVote = value === 0 ? 0 : value;
        const scoreDelta = newVote - oldVote;
        return {
          ...entry,
          currentUserVote: value === 0 ? null : value,
          voteScore: entry.voteScore + scoreDelta,
        };
      };
      setQueue((prev) => prev.map(applyVote));
      setNowPlaying((prev) => (prev ? applyVote(prev) : null));

      try {
        await voteOnEntry(entryId, value);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Vote failed");
        fetchQueue();
      }
    },
    [fetchQueue],
  );

  const addSong = useCallback(
    async (songId?: string, spotifyTrackId?: string) => {
      const entry = await addToQueue(songId, spotifyTrackId);
      showToast("Song added to queue!", "success");
      return entry;
    },
    [showToast],
  );

  return (
    <QueueContext.Provider
      value={{
        queue,
        nowPlaying,
        isLoading,
        error,
        queuedSongIds,
        queuedSpotifyTrackIds,
        vote,
        addSong,
        refresh: fetchQueue,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("useQueue must be used within QueueProvider");
  return ctx;
}
