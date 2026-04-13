/*
  Warnings:

  - Added the required column `passwordHash` to the `Venue` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Venue" ("createdAt", "email", "id", "name", "phone", "settings", "slug", "updatedAt") SELECT "createdAt", "email", "id", "name", "phone", "settings", "slug", "updatedAt" FROM "Venue";
DROP TABLE "Venue";
ALTER TABLE "new_Venue" RENAME TO "Venue";
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
