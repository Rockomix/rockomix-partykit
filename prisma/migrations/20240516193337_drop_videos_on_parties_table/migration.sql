/*
  Warnings:

  - You are about to drop the `VideosOnParties` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VideosOnParties" DROP CONSTRAINT "VideosOnParties_partyId_fkey";

-- DropForeignKey
ALTER TABLE "VideosOnParties" DROP CONSTRAINT "VideosOnParties_videoId_fkey";

-- DropTable
DROP TABLE "VideosOnParties";
