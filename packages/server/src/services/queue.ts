import { prisma, parseSettings } from "../lib/prisma.js";
import type { QueueEntry, QueueResponse, QueueHistoryResponse, VenueSettings } from "@playplay/shared";
import { QUEUE_STATUS, DEFAULTS } from "@playplay/shared";

// ---- Helpers ----

function formatEntry(
  entry: any,
  currentUserId?: string
): QueueEntry {
  const currentUserVote = currentUserId
    ? entry.votes?.find((v: any) => v.userId === currentUserId)?.value ?? null
    : null;

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
      ? { id: entry.addedBy.id, displayName: entry.addedBy.displayName, avatarEmoji: entry.addedBy.avatarEmoji ?? null }
      : null,
    status: entry.status,
    voteScore: entry.voteScore,
    currentUserVote,
    createdAt: entry.createdAt.toISOString(),
    playedAt: entry.playedAt?.toISOString() ?? null,
  };
}

function getVenueSettings(venue: { settings: any }): VenueSettings {
  const s = parseSettings(venue.settings);
  return {
    voteThreshold: (s.voteThreshold as number) ?? DEFAULTS.VOTE_THRESHOLD,
    maxSongsPerUser: (s.maxSongsPerUser as number) ?? DEFAULTS.MAX_SONGS_PER_USER,
    defaultPlaylistPath: (s.defaultPlaylistPath as string) ?? "",
    displayQrSize: (s.displayQrSize as number) ?? DEFAULTS.DISPLAY_QR_SIZE,
    displayShowHeader: (s.displayShowHeader as boolean) ?? DEFAULTS.DISPLAY_SHOW_HEADER,
    otpDeliveryMode: (s.otpDeliveryMode as string as VenueSettings["otpDeliveryMode"]) ?? DEFAULTS.OTP_DELIVERY_MODE,
    smsGatewayUrl: (s.smsGatewayUrl as string) ?? "",
    musicSource: (s.musicSource as string as VenueSettings["musicSource"]) ?? DEFAULTS.MUSIC_SOURCE,
    allowFullCatalogSearch: (s.allowFullCatalogSearch as boolean) ?? DEFAULTS.ALLOW_FULL_CATALOG_SEARCH,
  };
}

const ENTRY_INCLUDE = {
  song: true,
  addedBy: { select: { id: true, displayName: true, avatarEmoji: true } },
  votes: { select: { userId: true, value: true } },
} as const;

// ---- Public API ----

export async function addToQueue(
  userId: string,
  songId: string,
  venueId: string
): Promise<QueueEntry> {
  const [song, venue, existingEntry, userQueuedCount] = await Promise.all([
    prisma.song.findFirst({ where: { id: songId, venueId } }),
    prisma.venue.findUnique({ where: { id: venueId } }),
    prisma.queueEntry.findFirst({
      where: { songId, venueId, status: QUEUE_STATUS.QUEUED },
    }),
    prisma.queueEntry.count({
      where: { addedById: userId, venueId, status: QUEUE_STATUS.QUEUED },
    }),
  ]);

  if (!song) {
    throw new QueueError(404, "song_not_found", "Song not found");
  }
  if (song.blocked) {
    throw new QueueError(400, "song_blocked", "This song is currently blocked");
  }
  if (!venue) {
    throw new QueueError(404, "venue_not_found", "Venue not found");
  }
  if (existingEntry) {
    throw new QueueError(409, "duplicate", "This song is already in the queue");
  }

  const settings = getVenueSettings(venue);
  if (userQueuedCount >= settings.maxSongsPerUser) {
    throw new QueueError(
      400,
      "max_songs_reached",
      `You can only have ${settings.maxSongsPerUser} songs in the queue at a time`
    );
  }

  const [entry] = await prisma.$transaction([
    prisma.queueEntry.create({
      data: {
        songId,
        addedById: userId,
        venueId,
        status: QUEUE_STATUS.QUEUED,
        voteScore: 0,
      },
      include: ENTRY_INCLUDE,
    }),
    prisma.song.update({
      where: { id: songId },
      data: { totalAdds: { increment: 1 } },
    }),
  ]);

  return formatEntry(entry, userId);
}

export async function voteOnEntry(
  userId: string,
  entryId: string,
  value: 1 | -1 | 0
): Promise<QueueEntry> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.queueEntry.findUnique({
      where: { id: entryId },
      include: { venue: true },
    });

    if (!entry) {
      throw new QueueError(404, "entry_not_found", "Queue entry not found");
    }
    if (entry.status !== QUEUE_STATUS.QUEUED) {
      throw new QueueError(400, "invalid_status", "Can only vote on queued entries");
    }

    if (value === 0) {
      // Remove the vote (cancel/undo)
      await tx.vote.deleteMany({
        where: { queueEntryId: entryId, userId },
      });
    } else {
      await tx.vote.upsert({
        where: { queueEntryId_userId: { queueEntryId: entryId, userId } },
        create: { queueEntryId: entryId, userId, value },
        update: { value },
      });
    }

    // Recalculate score
    const agg = await tx.vote.aggregate({
      where: { queueEntryId: entryId },
      _sum: { value: true },
    });
    const newScore = agg._sum.value ?? 0;

    const settings = getVenueSettings(entry.venue);
    const newStatus =
      newScore <= settings.voteThreshold ? QUEUE_STATUS.REMOVED : entry.status;

    const updated = await tx.queueEntry.update({
      where: { id: entryId },
      data: { voteScore: newScore, status: newStatus },
      include: ENTRY_INCLUDE,
    });

    return formatEntry(updated, userId);
  });
}

export async function getQueue(
  venueId: string,
  userId?: string
): Promise<QueueResponse> {
  const [nowPlayingRaw, queueRaw] = await Promise.all([
    prisma.queueEntry.findFirst({
      where: { venueId, status: QUEUE_STATUS.PLAYING },
      include: ENTRY_INCLUDE,
    }),
    prisma.queueEntry.findMany({
      where: { venueId, status: QUEUE_STATUS.QUEUED },
      include: ENTRY_INCLUDE,
      orderBy: [
        { position: { sort: "asc", nulls: "last" } },
        { voteScore: "desc" },
        { createdAt: "asc" },
      ],
    }),
  ]);

  return {
    nowPlaying: nowPlayingRaw ? formatEntry(nowPlayingRaw, userId) : null,
    queue: queueRaw.map((e) => formatEntry(e, userId)),
  };
}

export async function getHistory(
  venueId: string,
  page: number,
  limit: number
): Promise<QueueHistoryResponse> {
  const skip = (page - 1) * limit;
  const where = { venueId, status: QUEUE_STATUS.PLAYED };

  const [entries, total] = await Promise.all([
    prisma.queueEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: { playedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.queueEntry.count({ where }),
  ]);

  return {
    entries: entries.map((e) => formatEntry(e)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function removeEntry(
  entryId: string,
  venueId: string
): Promise<void> {
  const entry = await prisma.queueEntry.findFirst({
    where: { id: entryId, venueId, status: QUEUE_STATUS.QUEUED },
  });

  if (!entry) {
    throw new QueueError(404, "entry_not_found", "Queued entry not found");
  }

  await prisma.queueEntry.update({
    where: { id: entryId },
    data: { status: QUEUE_STATUS.REMOVED },
  });
}

export async function playNow(
  entryId: string,
  venueId: string
): Promise<QueueEntry> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.queueEntry.findFirst({
      where: { id: entryId, venueId, status: QUEUE_STATUS.QUEUED },
    });

    if (!entry) {
      throw new QueueError(404, "entry_not_found", "Queued entry not found");
    }

    // Move current playing → played
    await tx.queueEntry.updateMany({
      where: { venueId, status: QUEUE_STATUS.PLAYING },
      data: { status: QUEUE_STATUS.PLAYED, playedAt: new Date() },
    });

    // Set target → playing
    const [updated] = await Promise.all([
      tx.queueEntry.update({
        where: { id: entryId },
        data: { status: QUEUE_STATUS.PLAYING, playedAt: new Date() },
        include: ENTRY_INCLUDE,
      }),
      tx.song.update({
        where: { id: entry.songId },
        data: { totalPlays: { increment: 1 } },
      }),
    ]);

    return formatEntry(updated);
  });
}

export async function reorderQueue(
  venueId: string,
  entryIds: string[]
): Promise<void> {
  // Verify all entries belong to this venue and are QUEUED
  const entries = await prisma.queueEntry.findMany({
    where: { id: { in: entryIds }, venueId, status: QUEUE_STATUS.QUEUED },
    select: { id: true },
  });

  const foundIds = new Set(entries.map((e) => e.id));
  const invalid = entryIds.filter((id) => !foundIds.has(id));
  if (invalid.length > 0) {
    throw new QueueError(400, "invalid_entries", "Some entry IDs are invalid or not queued");
  }

  await prisma.$transaction(
    entryIds.map((id, index) =>
      prisma.queueEntry.update({
        where: { id },
        data: { position: index },
      })
    )
  );
}

// ---- Error class ----

export class QueueError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "QueueError";
  }
}
