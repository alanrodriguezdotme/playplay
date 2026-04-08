/*
  Warnings:

  - A unique constraint covering the columns `[filePath,venueId]` on the table `Song` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Song_filePath_venueId_key" ON "Song"("filePath", "venueId");
