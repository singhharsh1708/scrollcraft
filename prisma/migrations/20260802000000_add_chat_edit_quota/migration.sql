-- Per-user AI chat quota, metered separately from image/video credits.
ALTER TABLE "User" ADD COLUMN "chatEditsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "chatPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
