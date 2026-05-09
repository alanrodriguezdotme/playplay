import { useEffect } from "react";
import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueResponse, QueueEntry } from "@playplay/shared";
import { useSocketContext } from "../contexts/SocketContext";

export { useSocketContext as useSocket };

export interface QueueUpdateHandlers {
  onQueueUpdated?: (data: QueueResponse) => void;
  onNowPlayingChanged?: (entry: QueueEntry | null) => void;
  onEntryAdded?: (entry: QueueEntry) => void;
  onEntryRemoved?: (entryId: string) => void;
}

export function useQueueUpdates(
  handlers: QueueUpdateHandlers
): void {
  const { socket, joinVenue } = useSocketContext();

  // Subscribe to queue events AND join venue in a single effect
  // to ensure listeners are registered before the join response arrives
  useEffect(() => {
    if (!socket) return;

    const { onQueueUpdated, onNowPlayingChanged, onEntryAdded, onEntryRemoved } = handlers;

    // Register listeners first
    if (onQueueUpdated) socket.on(SOCKET_EVENTS.QUEUE_UPDATED, onQueueUpdated);
    if (onNowPlayingChanged) socket.on(SOCKET_EVENTS.NOW_PLAYING_CHANGED, onNowPlayingChanged);
    if (onEntryAdded) socket.on(SOCKET_EVENTS.QUEUE_ENTRY_ADDED, onEntryAdded);
    if (onEntryRemoved) socket.on(SOCKET_EVENTS.QUEUE_ENTRY_REMOVED, onEntryRemoved);

    // Then join the venue room (server sends QUEUE_UPDATED in response)
    joinVenue();

    return () => {
      if (onQueueUpdated) socket.off(SOCKET_EVENTS.QUEUE_UPDATED, onQueueUpdated);
      if (onNowPlayingChanged) socket.off(SOCKET_EVENTS.NOW_PLAYING_CHANGED, onNowPlayingChanged);
      if (onEntryAdded) socket.off(SOCKET_EVENTS.QUEUE_ENTRY_ADDED, onEntryAdded);
      if (onEntryRemoved) socket.off(SOCKET_EVENTS.QUEUE_ENTRY_REMOVED, onEntryRemoved);
    };
  }, [socket, joinVenue, handlers.onQueueUpdated, handlers.onNowPlayingChanged, handlers.onEntryAdded, handlers.onEntryRemoved]);
}
