-- CreateTable
CREATE TABLE "SpotifyAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpotifyAuth_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local',
    "spotifyTrackId" TEXT,
    "spotifyUri" TEXT,
    "artworkUrl" TEXT,
    "previewUrl" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "totalPlays" INTEGER NOT NULL DEFAULT 0,
    "totalAdds" INTEGER NOT NULL DEFAULT 0,
    "venueId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Song_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Song" ("album", "artist", "blocked", "createdAt", "duration", "filePath", "id", "isDefault", "title", "totalAdds", "totalPlays", "venueId") SELECT "album", "artist", "blocked", "createdAt", "duration", "filePath", "id", "isDefault", "title", "totalAdds", "totalPlays", "venueId" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
CREATE INDEX "Song_venueId_idx" ON "Song"("venueId");
CREATE INDEX "Song_title_artist_idx" ON "Song"("title", "artist");
CREATE UNIQUE INDEX "Song_filePath_venueId_key" ON "Song"("filePath", "venueId");
CREATE UNIQUE INDEX "Song_spotifyTrackId_venueId_key" ON "Song"("spotifyTrackId", "venueId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyAuth_venueId_key" ON "SpotifyAuth"("venueId");
