import { prisma } from "./prisma.js";

interface CachedVenue {
  id: string;
  slug: string;
}

let cachedVenue: CachedVenue | null = null;

/**
 * Resolve the single venue this server instance hosts.
 * Uses VENUE_SLUG env var if set, otherwise expects exactly one venue in the DB.
 * Result is cached after the first call.
 */
export async function getDefaultVenue(): Promise<CachedVenue> {
  if (cachedVenue) return cachedVenue;

  const slug = process.env.VENUE_SLUG;

  if (slug) {
    const venue = await prisma.venue.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!venue) throw new Error(`Venue with slug "${slug}" not found`);
    cachedVenue = venue;
    return venue;
  }

  // No env var — expect exactly one venue
  const venues = await prisma.venue.findMany({
    select: { id: true, slug: true },
    take: 2,
  });

  if (venues.length === 0) throw new Error("No venues found in database");
  if (venues.length > 1)
    throw new Error(
      "Multiple venues found. Set VENUE_SLUG env var to specify which venue to use.",
    );

  cachedVenue = venues[0]!;
  return cachedVenue;
}

export async function getDefaultVenueId(): Promise<string> {
  return (await getDefaultVenue()).id;
}

export async function getDefaultVenueSlug(): Promise<string> {
  return (await getDefaultVenue()).slug;
}
