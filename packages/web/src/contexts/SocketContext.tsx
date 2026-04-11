import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@playplay/shared";
import { getStoredToken } from "../api/client";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  hasConnected: boolean;
  joinVenue: (slug: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastSlugRef = useRef<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();

    const serverUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(serverUrl, {
      auth: token ? { token } : {},
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setHasConnected(true);
      // Rejoin last venue on reconnect
      if (lastSlugRef.current) {
        socket.emit(SOCKET_EVENTS.VENUE_JOIN, lastSlugRef.current);
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinVenue = useCallback((slug: string) => {
    lastSlugRef.current = slug;
    socketRef.current?.emit(SOCKET_EVENTS.VENUE_JOIN, slug);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        hasConnected,
        joinVenue,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx)
    throw new Error("useSocketContext must be used within SocketProvider");
  return ctx;
}
