import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean slate
  await prisma.vote.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.song.deleteMany();
  await prisma.user.deleteMany();
  await prisma.venue.deleteMany();

  const passwordHash = await bcrypt.hash("admin", 10);

  // Create venue
  const venue = await prisma.venue.create({
    data: {
      name: "The Underground Lounge",
      slug: "underground-lounge",
      email: "admin@underground.local",
      phone: "+1234567890",
      passwordHash,
      settings: JSON.stringify({
        voteThreshold: -5,
        maxSongsPerUser: 3,
        defaultPlaylist: {
          source: "history",
          shuffle: true,
          history: { lookbackDays: null },
        },
      }),
    },
  });

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      displayName: "Admin",
      role: "ADMIN",
      venueId: venue.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Venue: ${venue.name} (${venue.slug})`);
  console.log(`  Admin: ${admin.displayName}`);
  console.log(`  Admin password: admin`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
