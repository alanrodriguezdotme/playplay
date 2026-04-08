import { SOCKET_EVENTS } from "@playplay/shared";
import type { QueueEntry } from "@playplay/shared";
import { getIO } from "./index.js";
import { getQueue } from "../services/queue.js";
import { prisma } from "../lib/prisma.js";

// Cache venue slug lookups (venueId → slug)
const slugCache = new Map<string, string>();

async function getVenueSlug(venueId: string): Promise<string> {
  const cached = slugCache.get(venueId);
  if (cached) return cached;

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { slug: true },
  });

  if (!venue) throw new Error(`Venue not found: ${venueId}`);
  slugCache.set(venueId, venue.slug);
  return venue.slug;
}

function getRoomName(slug: string): string {
  return `venue:${slug}`;
}

export async function broadcastQueueUpdated(venueId: string): Promise<void> {
  const [slug, queueState] = await Promise.all([
    getVenueSlug(venueId),
    getQueue(venueId),
  ]);
  getIO().to(getRoomName(slug)).emit(SOCKET_EVENTS.QUEUE_UPDATED, queueState);
}

export async function broadcastNowPlayingChanged(
  venueId: string,
  entry: QueueEntry | null
): Promise<void> {
  const slug = await getVenueSlug(venueId);
  getIO().to(getRoomName(slug)).emit(SOCKET_EVENTS.NOW_PLAYING_CHANGED, entry);
}

export async function broadcastEntryAdded(
  venueId: string,
  entry: QueueEntry
): Promise<void> {
  const slug = await getVenueSlug(venueId);
  getIO().to(getRoomName(slug)).emit(SOCKET_EVENTS.QUEUE_ENTRY_ADDED, entry);
}

export async function broadcastEntryRemoved(
  venueId: string,
  entryId: string
): Promise<void> {
  const slug = await getVenueSlug(venueId);
  getIO().to(getRoomName(slug)).emit(SOCKET_EVENTS.QUEUE_ENTRY_REMOVED, entryId);
}
