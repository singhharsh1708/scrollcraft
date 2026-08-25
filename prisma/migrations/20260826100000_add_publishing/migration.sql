-- Theme and background recipe stored as data, so the published page and the exporter can
-- recompile them; frames themselves never reach the server.
ALTER TABLE "Site" ADD COLUMN "themeJson" TEXT;
ALTER TABLE "Site" ADD COLUMN "styleJson" TEXT;
ALTER TABLE "Site" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Site" ADD COLUMN "publishSlug" TEXT;
ALTER TABLE "Site" ADD COLUMN "publishedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Site_publishSlug_key" ON "Site"("publishSlug");
