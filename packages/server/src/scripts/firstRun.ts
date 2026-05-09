import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma, parseSettings, stringifySettings } from "../lib/prisma.js";
import { encryptSecret } from "../lib/secrets.js";

interface FirstRunAnswers {
  venueName: string;
  venueSlug: string;
  adminEmail: string;
  adminPassword: string;
  musicSource: "local" | "spotify" | "skip";
  musicLibraryPath?: string;
  spotify?: {
    clientId?: string;
    clientSecret?: string;
    relayUrl?: string;
  };
}

function loadAnswers(): FirstRunAnswers {
  const argPath = process.argv[2];
  if (argPath) {
    return JSON.parse(readFileSync(argPath, "utf-8")) as FirstRunAnswers;
  }
  if (process.env.PLAYPLAY_ANSWERS) {
    return JSON.parse(process.env.PLAYPLAY_ANSWERS) as FirstRunAnswers;
  }
  throw new Error("No answers provided. Pass a JSON file path as the first argument or set PLAYPLAY_ANSWERS.");
}

async function main() {
  const answers = loadAnswers();
  const passwordHash = await bcrypt.hash(answers.adminPassword, 10);

  const existing = await prisma.venue.findFirst();
  const venueId = existing?.id;

  // Carry over existing settings; overwrite first-run-relevant fields.
  const baseSettings = existing ? parseSettings(existing.settings) : {};

  const musicSource = answers.musicSource === "spotify" ? "spotify" : "local";
  const settings: Record<string, unknown> = {
    ...baseSettings,
    musicSource,
    isConfigured: true,
  };

  if (answers.musicLibraryPath) {
    settings.musicLibraryPath = answers.musicLibraryPath;
  }

  if (answers.spotify && (answers.spotify.clientId || answers.spotify.clientSecret)) {
    const spotify = (settings.spotify && typeof settings.spotify === "object")
      ? { ...(settings.spotify as Record<string, unknown>) }
      : {};
    if (answers.spotify.clientId) spotify.clientIdEnc = encryptSecret(answers.spotify.clientId);
    if (answers.spotify.clientSecret) spotify.clientSecretEnc = encryptSecret(answers.spotify.clientSecret);
    if (answers.spotify.relayUrl) spotify.relayUrl = answers.spotify.relayUrl;
    settings.spotify = spotify;
  }

  let venue;
  if (venueId) {
    venue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        name: answers.venueName,
        slug: answers.venueSlug,
        email: answers.adminEmail,
        passwordHash,
        settings: stringifySettings(settings),
      },
    });
  } else {
    venue = await prisma.venue.create({
      data: {
        name: answers.venueName,
        slug: answers.venueSlug,
        email: answers.adminEmail,
        phone: "",
        passwordHash,
        settings: stringifySettings(settings),
      },
    });
  }

  // Ensure an ADMIN user exists for the venue.
  const admin = await prisma.user.findFirst({
    where: { venueId: venue.id, role: "ADMIN" },
  });
  if (!admin) {
    await prisma.user.create({
      data: {
        displayName: "Admin",
        role: "ADMIN",
        venueId: venue.id,
      },
    });
  }

  console.log(JSON.stringify({ ok: true, venueId: venue.id, slug: venue.slug }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
