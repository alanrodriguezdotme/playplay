import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SOCKET_EVENTS } from "@playplay/shared";
import { verifyToken } from "../services/auth.js";
import { prisma } from "../lib/prisma.js";
import { getQueue } from "../services/queue.js";
import { advanceQueue } from "../services/playback.js";
import { broadcastQueueUpdated, broadcastNowPlayingChanged } from "./broadcast.js";
import {
  getPlaybackState,
  claimAudio,
  releaseAudio,
  clearOwnerOnDisconnect,
  isAudioOwner,
  setPlaying,
  updatePlaybackPosition,
  setCurrentSong,
} from "../services/playbackState.js";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

function broadcastPlaybackSync(venueId: string, slug: string): void {
  const state = getPlaybackState(venueId);
  getIO().to(`venue:${slug}`).emit(SOCKET_EVENTS.PLAYBACK_SYNC, state);
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

        // Send current playback state
        const playbackState = getPlaybackState(venue.id);
        socket.emit(SOCKET_EVENTS.PLAYBACK_SYNC, playbackState);
      } catch (err) {
        console.error("venue:join error:", err);
        socket.emit("error", { message: "Failed to join venue" });
      }
    });

    // ---- Audio ownership ----

    socket.on(SOCKET_EVENTS.PLAYBACK_CLAIM, (data: { deviceHint?: string }) => {
      const venueId = socket.data.venueId;
      const slug = socket.data.venueSlug;
      if (!venueId || !slug || socket.data.role !== "ADMIN") return;

      const deviceHint = typeof data?.deviceHint === "string" ? data.deviceHint.slice(0, 100) : "Unknown device";
      const { previousOwner } = claimAudio(venueId, socket.id, deviceHint);

      // Tell old owner to release
      if (previousOwner && previousOwner !== socket.id) {
        io!.to(previousOwner).emit(SOCKET_EVENTS.PLAYBACK_RELEASE);
      }

      broadcastPlaybackSync(venueId, slug);
    });

    socket.on(SOCKET_EVENTS.PLAYBACK_RELEASE, () => {
      const venueId = socket.data.venueId;
      const slug = socket.data.venueSlug;
      if (!venueId || !slug) return;

      releaseAudio(venueId, socket.id);
      broadcastPlaybackSync(venueId, slug);
    });

    // ---- Playback control (any admin) ----

    socket.on(SOCKET_EVENTS.PLAYBACK_PLAY, () => {
      const venueId = socket.data.venueId;
      const slug = socket.data.venueSlug;
      if (!venueId || !slug || socket.data.role !== "ADMIN") return;

      setPlaying(venueId, true);

      // Forward to audio owner
      const state = getPlaybackState(venueId);
      if (state.audioOwnerSocketId) {
        io!.to(state.audioOwnerSocketId).emit(SOCKET_EVENTS.PLAYBACK_PLAY);
      }
      broadcastPlaybackSync(venueId, slug);
    });

    socket.on(SOCKET_EVENTS.PLAYBACK_PAUSE, () => {
      const venueId = socket.data.venueId;
      const slug = socket.data.venueSlug;
      if (!venueId || !slug || socket.data.role !== "ADMIN") return;

      setPlaying(venueId, false);

      // Forward to audio owner
      const state = getPlaybackState(venueId);
      if (state.audioOwnerSocketId) {
        io!.to(state.audioOwnerSocketId).emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
      }
      broadcastPlaybackSync(venueId, slug);
    });

    // ---- Playback lifecycle (audio owner only) ----

    socket.on(SOCKET_EVENTS.PLAYBACK_ENDED, async () => {
      try {
        const venueId = socket.data.venueId;
        const slug = socket.data.venueSlug;
        if (!venueId || !slug) return;
        if (socket.data.role !== "ADMIN" || !isAudioOwner(venueId, socket.id)) return;

        const newEntry = await advanceQueue(venueId);
        setCurrentSong(venueId, newEntry?.song.id ?? null);
        if (newEntry) setPlaying(venueId, true);

        await broadcastNowPlayingChanged(venueId, newEntry);
        await broadcastQueueUpdated(venueId);
        broadcastPlaybackSync(venueId, slug);
      } catch (err) {
        console.error("playback:ended error:", err);
      }
    });

    socket.on(SOCKET_EVENTS.PLAYBACK_START, async () => {
      try {
        const venueId = socket.data.venueId;
        const slug = socket.data.venueSlug;
        if (!venueId || !slug) return;
        if (socket.data.role !== "ADMIN" || !isAudioOwner(venueId, socket.id)) return;

        const newEntry = await advanceQueue(venueId);
        setCurrentSong(venueId, newEntry?.song.id ?? null);
        if (newEntry) setPlaying(venueId, true);

        await broadcastNowPlayingChanged(venueId, newEntry);
        await broadcastQueueUpdated(venueId);
        broadcastPlaybackSync(venueId, slug);
      } catch (err) {
        console.error("playback:start error:", err);
      }
    });

    // Audio owner reports playback position
    socket.on(SOCKET_EVENTS.PLAYBACK_STATE, (data: { isPlaying: boolean; currentTime: number; duration: number }) => {
      const venueId = socket.data.venueId;
      const slug = socket.data.venueSlug;
      if (!venueId || !slug) return;
      if (!isAudioOwner(venueId, socket.id)) return;

      setPlaying(venueId, data.isPlaying);
      updatePlaybackPosition(venueId, data.currentTime, data.duration);
      broadcastPlaybackSync(venueId, slug);
    });

    // ---- Venue OTP relay (unchanged) ----

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // If this socket was an audio owner, clear it and notify
      const affectedVenueId = clearOwnerOnDisconnect(socket.id);
      if (affectedVenueId && socket.data.venueSlug) {
        broadcastPlaybackSync(affectedVenueId, socket.data.venueSlug);
      }
    });
  });

  return io;
}
