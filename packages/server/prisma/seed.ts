import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate
  await prisma.vote.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.song.deleteMany();
  await prisma.user.deleteMany();
  await prisma.venue.deleteMany();

  // Create venue
  const venue = await prisma.venue.create({
    data: {
      name: "The Underground Lounge",
      slug: "underground-lounge",
      email: "admin@underground.local",
      phone: "+1234567890",
      settings: JSON.stringify({
        voteThreshold: -5,
        maxSongsPerUser: 3,
        defaultPlaylistPath: "./music/default",
      }),
    },
  });

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      phone: "+1999999999",
      displayName: "Admin",
      role: "ADMIN",
      venueId: venue.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Venue: ${venue.name} (${venue.slug})`);
  console.log(`  Admin: ${admin.displayName} (${admin.phone})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
