-- Track when a paid plan lapses. Null on existing rows means no expiry, so no one who
-- already paid is downgraded; every new grant sets this going forward.
ALTER TABLE "User" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
