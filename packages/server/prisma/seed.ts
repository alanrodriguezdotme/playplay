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
      settings: {
        voteThreshold: -5,
        maxSongsPerUser: 3,
        defaultPlaylistPath: "./music/default",
      },
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

  // Create patron
  const patron = await prisma.user.create({
    data: {
      phone: "+1111111111",
      displayName: "Alice",
      role: "PATRON",
      venueId: venue.id,
    },
  });

  // Create sample songs
  await prisma.song.createMany({
    data: [
      {
        title: "Take Five",
        artist: "Dave Brubeck",
        album: "Time Out",
        duration: 324,
        filePath: "music/brubeck-take-five.mp3",
        venueId: venue.id,
      },
      {
        title: "Bohemian Rhapsody",
        artist: "Queen",
        album: "A Night at the Opera",
        duration: 354,
        filePath: "music/queen-bohemian-rhapsody.mp3",
        venueId: venue.id,
      },
      {
        title: "So What",
        artist: "Miles Davis",
        album: "Kind of Blue",
        duration: 562,
        filePath: "music/miles-davis-so-what.mp3",
        venueId: venue.id,
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  Venue: ${venue.name} (${venue.slug})`);
  console.log(`  Admin: ${admin.displayName} (${admin.phone})`);
  console.log(`  Patron: ${patron.displayName} (${patron.phone})`);
  console.log(`  Songs: 3 created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
