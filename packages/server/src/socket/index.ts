import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SOCKET_EVENTS } from "@playplay/shared";
import { verifyToken } from "../services/auth.js";
import { prisma } from "../lib/prisma.js";
import { getQueue } from "../services/queue.js";
import { advanceQueue } from "../services/playback.js";
import { broadcastQueueUpdated, broadcastNowPlayingChanged } from "./broadcast.js";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Auth middleware — optional (unauthenticated clients allowed for Now Playing display)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        socket.data.venueId = payload.venueId;
        socket.data.role = payload.role;
      } catch {
        // Invalid token — allow connection but without user data
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.data.userId ?? "anonymous"})`);

    socket.on(SOCKET_EVENTS.VENUE_JOIN, async (slug: string) => {
      try {
        const venue = await prisma.venue.findUnique({ where: { slug } });
        if (!venue) {
          socket.emit("error", { message: "Venue not found" });
          return;
        }

        // Leave any previous venue rooms
        for (const room of socket.rooms) {
          if (room.startsWith("venue:") && room !== socket.id) {
            socket.leave(room);
          }
        }

        const roomName = `venue:${slug}`;
        socket.join(roomName);
        socket.data.venueSlug = slug;
        socket.data.venueId = venue.id;

        // Send current queue state to the joining client
        const queueState = await getQueue(venue.id, socket.data.userId);
        socket.emit(SOCKET_EVENTS.QUEUE_UPDATED, queueState);
      } catch (err) {
        console.error("venue:join error:", err);
        socket.emit("error", { message: "Failed to join venue" });
      }
    });

    socket.on(SOCKET_EVENTS.PLAYBACK_ENDED, async () => {
      try {
        const venueId = socket.data.venueId;
        if (!venueId) return;

        const newEntry = await advanceQueue(venueId);
        await broadcastNowPlayingChanged(venueId, newEntry);
        await broadcastQueueUpdated(venueId);
      } catch (err) {
        console.error("playback:ended error:", err);
      }
    });

    // Admin → Display: playback control relay
    socket.on(SOCKET_EVENTS.PLAYBACK_PLAY, () => {
      const slug = socket.data.venueSlug;
      if (!slug || socket.data.role !== "ADMIN") return;
      socket.to(`venue:${slug}`).emit(SOCKET_EVENTS.PLAYBACK_PLAY);
    });

    socket.on(SOCKET_EVENTS.PLAYBACK_PAUSE, () => {
      const slug = socket.data.venueSlug;
      if (!slug || socket.data.role !== "ADMIN") return;
      socket.to(`venue:${slug}`).emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
    });

    // Display → Admin: playback state relay
    socket.on(SOCKET_EVENTS.PLAYBACK_STATE, (state: { isPlaying: boolean; currentTime: number; duration: number }) => {
      const slug = socket.data.venueSlug;
      if (!slug) return;
      socket.to(`venue:${slug}`).emit(SOCKET_EVENTS.PLAYBACK_STATE, state);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
