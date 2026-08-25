-- The Auth.js adapter passes emailVerified to user.create on every sign-up, so without
-- this column Prisma rejects the insert and no new account can be created.
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
