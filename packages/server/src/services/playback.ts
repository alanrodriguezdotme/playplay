import { prisma } from "../lib/prisma.js";
import { QUEUE_STATUS } from "@playplay/shared";
import type { QueueEntry, DefaultPlaylistConfig, MusicSource } from "@playplay/shared";
import { getVenueSettings } from "../lib/settings.js";
import { getFallbackCursor, setFallbackCursor } from "./playbackState.js";

const ENTRY_INCLUDE = {
  song: true,
  addedBy: { select: { id: true, displayName: true, avatarEmoji: true, role: true } },
  votes: { select: { userId: true, value: true } },
} as const;

function formatEntry(entry: any): QueueEntry {
  return {
    id: entry.id,
    song: {
      id: entry.song.id,
      title: entry.song.title,
      artist: entry.song.artist,
      album: entry.song.album,
      duration: entry.song.duration,
      totalPlays: entry.song.totalPlays,
      totalAdds: entry.song.totalAdds,
      isBlocked: entry.song.blocked,
      isFallbackOnly: entry.song.isFallbackOnly ?? false,
      source: entry.song.source ?? "local",
      spotifyTrackId: entry.song.spotifyTrackId ?? null,
      artworkUrl: entry.song.artworkUrl ?? null,
      previewUrl: entry.song.previewUrl ?? null,
      spotifyUri: entry.song.spotifyUri ?? null,
    },
    addedBy: entry.addedBy
      ? { id: entry.addedBy.id, displayName: entry.addedBy.displayName, avatarEmoji: entry.addedBy.avatarEmoji ?? null, role: entry.addedBy.role }
      : null,
    status: entry.status,
    voteScore: entry.voteScore,
    currentUserVote: null,
    createdAt: entry.createdAt.toISOString(),
    playedAt: entry.playedAt?.toISOString() ?? null,
  };
}

function configKey(config: DefaultPlaylistConfig): string {
  if (config.source === "history") return `history:${config.history?.lookbackDays ?? "all"}:${config.shuffle}`;
  if (config.source === "local") return `local:${config.local?.kind ?? ""}:${config.local?.path ?? ""}:${config.shuffle}`;
  if (config.source === "spotify") return `spotify:${config.spotify?.playlistId ?? ""}:${config.shuffle}`;
  return "none";
}

function pickNext<T extends { id: string }>(
  candidates: T[],
  shuffle: boolean,
  lastId: string | null,
): T | null {
  if (candidates.length === 0) return null;
  if (shuffle) {
    if (candidates.length === 1) return candidates[0]!;
    // Try not to pick the same song twice in a row
    let pick: T;
    let attempts = 0;
    do {
      pick = candidates[Math.floor(Math.random() * candidates.length)]!;
      attempts++;
    } while (pick.id === lastId && attempts < 5);
    return pick;
  }
  if (!lastId) return candidates[0]!;
  const idx = candidates.findIndex((c) => c.id === lastId);
  if (idx === -1 || idx + 1 >= candidates.length) return candidates[0]!;
  return candidates[idx + 1]!;
}

async function pickFromHistory(
  venueId: string,
  musicSource: MusicSource,
  config: DefaultPlaylistConfig,
): Promise<{ id: string } | null> {
  const where: any = {
    venueId,
    status: QUEUE_STATUS.PLAYED,
    song: { blocked: false, source: musicSource, isFallbackOnly: false },
  };
  if (config.history?.lookbackDays && config.history.lookbackDays > 0) {
    const since = new Date(Date.now() - config.history.lookbackDays * 24 * 60 * 60 * 1000);
    where.playedAt = { gte: since };
  }

  // Distinct songId across history, ordered by most-recent play
  const rows = await prisma.queueEntry.findMany({
    where,
    select: { songId: true, playedAt: true },
    orderBy: { playedAt: "desc" },
    take: 500,
  });
  if (rows.length === 0) return null;
  const seen = new Set<string>();
  const candidates: { id: string }[] = [];
  for (const r of rows) {
    if (seen.has(r.songId)) continue;
    seen.add(r.songId);
    candidates.push({ id: r.songId });
  }

  // Exclude songs currently queued or playing
  const active = await prisma.queueEntry.findMany({
    where: { venueId, status: { in: [QUEUE_STATUS.QUEUED, QUEUE_STATUS.PLAYING] } },
    select: { songId: true },
  });
  const activeSet = new Set(active.map((a) => a.songId));
  const filtered = candidates.filter((c) => !activeSet.has(c.id));
  if (filtered.length === 0) return null;

  const lastId = getFallbackCursor(venueId, configKey(config));
  const picked = pickNext(filtered, config.shuffle, lastId);
  return picked;
}

async function pickFromFallbackPool(
  venueId: string,
  musicSource: MusicSource,
  config: DefaultPlaylistConfig,
): Promise<{ id: string } | null> {
  const songs = await prisma.song.findMany({
    where: { venueId, isFallbackOnly: true, blocked: false, source: musicSource },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (songs.length === 0) return null;

  const lastId = getFallbackCursor(venueId, configKey(config));
  return pickNext(songs, config.shuffle, lastId);
}

/**
 * Clears the currently playing track WITHOUT advancing to the next queued song
 * or a default-playlist fallback. Used by the admin "Stop" control to return the
 * venue to the empty Now Playing state. Marks the current PLAYING entry as
 * PLAYED (counting the play) and returns the number of entries cleared.
 */
export async function stopPlayback(venueId: string): Promise<{ cleared: boolean }> {
  return prisma.$transaction(async (tx) => {
    const currentlyPlaying = await tx.queueEntry.findFirst({
      where: { venueId, status: QUEUE_STATUS.PLAYING },
    });
    if (!currentlyPlaying) return { cleared: false };

    await Promise.all([
      tx.queueEntry.update({
        where: { id: currentlyPlaying.id },
        data: { status: QUEUE_STATUS.PLAYED, playedAt: new Date() },
      }),
      tx.song.update({
        where: { id: currentlyPlaying.songId },
        data: { totalPlays: { increment: 1 } },
      }),
    ]);
    return { cleared: true };
  });
}

export async function advanceQueue(venueId: string): Promise<QueueEntry | null> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  const settings = venue ? getVenueSettings(venue) : null;

  return prisma.$transaction(async (tx) => {
    // 1. Move current PLAYING → PLAYED
    const currentlyPlaying = await tx.queueEntry.findFirst({
      where: { venueId, status: QUEUE_STATUS.PLAYING },
    });

    if (currentlyPlaying) {
      await Promise.all([
        tx.queueEntry.update({
          where: { id: currentlyPlaying.id },
          data: { status: QUEUE_STATUS.PLAYED, playedAt: new Date() },
        }),
        tx.song.update({
          where: { id: currentlyPlaying.songId },
          data: { totalPlays: { increment: 1 } },
        }),
      ]);
    }

    // 2. Find next QUEUED entry
    const nextEntry = await tx.queueEntry.findFirst({
      where: { venueId, status: QUEUE_STATUS.QUEUED },
      orderBy: [
        { position: { sort: "asc", nulls: "last" } },
        { voteScore: "desc" },
        { createdAt: "asc" },
      ],
    });

    if (nextEntry) {
      const updated = await tx.queueEntry.update({
        where: { id: nextEntry.id },
        data: { status: QUEUE_STATUS.PLAYING, playedAt: new Date() },
        include: ENTRY_INCLUDE,
      });
      return formatEntry(updated);
    }

    return null;
  }).then(async (queued) => {
    if (queued) return queued;
    if (!settings) return null;

    // 3. Queue is empty — pick from configured default playlist
    const config = settings.defaultPlaylist;
    const musicSource = settings.musicSource;
    let pick: { id: string } | null = null;

    if (config.source === "history") {
      pick = await pickFromHistory(venueId, musicSource, config);
    } else if (config.source === "local" || config.source === "spotify") {
      // Fallback-pool tracks are tagged with a specific source; use that source
      // to ensure playback path matches.
      const poolSource: MusicSource = config.source === "spotify" ? "spotify" : "local";
      pick = await pickFromFallbackPool(venueId, poolSource, config);
    }

    if (!pick) return null;

    setFallbackCursor(venueId, configKey(config), pick.id);

    const created = await prisma.queueEntry.create({
      data: {
        songId: pick.id,
        addedById: null,
        venueId,
        status: QUEUE_STATUS.PLAYING,
        voteScore: 0,
        playedAt: new Date(),
      },
      include: ENTRY_INCLUDE,
    });
    return formatEntry(created);
  });
}
