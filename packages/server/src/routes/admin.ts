import { Router } from "express";
import { resolve } from "node:path";
import { scanMusicLibrary } from "../services/music.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// POST /api/admin/music/scan — trigger music library scan
router.post("/music/scan", async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.user!.venueId },
    });

    if (!venue) {
      res.status(404).json({ error: "not_found", message: "Venue not found" });
      return;
    }

    const libraryPath = resolve(
      process.env.MUSIC_LIBRARY_PATH || "./music"
    );

    const result = await scanMusicLibrary(venue.id, libraryPath);

    console.log(
      `[Music Scan] venue=${venue.slug}: added=${result.added} updated=${result.updated} removed=${result.removed} errors=${result.errors.length}`
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
