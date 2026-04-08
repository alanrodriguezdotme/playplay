-- DropForeignKey
ALTER TABLE "QueueEntry" DROP CONSTRAINT "QueueEntry_addedById_fkey";

-- AlterTable
ALTER TABLE "QueueEntry" ALTER COLUMN "addedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
