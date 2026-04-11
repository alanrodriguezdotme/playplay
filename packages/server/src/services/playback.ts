import { prisma } from "../lib/prisma.js";
import { QUEUE_STATUS } from "@playplay/shared";
import type { QueueEntry } from "@playplay/shared";

const ENTRY_INCLUDE = {
  song: true,
  addedBy: { select: { id: true, displayName: true } },
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
      source: entry.song.source ?? "local",
      spotifyTrackId: entry.song.spotifyTrackId ?? null,
      artworkUrl: entry.song.artworkUrl ?? null,
      previewUrl: entry.song.previewUrl ?? null,
      spotifyUri: entry.song.spotifyUri ?? null,
    },
    addedBy: entry.addedBy
      ? { id: entry.addedBy.id, displayName: entry.addedBy.displayName }
      : null,
    status: entry.status,
    voteScore: entry.voteScore,
    currentUserVote: null,
    createdAt: entry.createdAt.toISOString(),
    playedAt: entry.playedAt?.toISOString() ?? null,
  };
}

export async function advanceQueue(venueId: string): Promise<QueueEntry | null> {
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

    // 3. No queued entries — pick random default song
    const defaultSongs = await tx.song.findMany({
      where: { venueId, isDefault: true, blocked: false },
      select: { id: true },
    });

    if (defaultSongs.length === 0) return null;

    const randomSong = defaultSongs[Math.floor(Math.random() * defaultSongs.length)];

    const created = await tx.queueEntry.create({
      data: {
        songId: randomSong.id,
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
