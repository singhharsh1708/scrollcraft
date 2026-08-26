-- Meta/social description for a published or exported site. Previously every description
-- tag just repeated the site name.
ALTER TABLE "Site" ADD COLUMN "description" TEXT;
