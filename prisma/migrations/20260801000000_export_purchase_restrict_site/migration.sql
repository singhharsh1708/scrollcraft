-- Deleting a site must not erase the record of money taken for it.
-- DropForeignKey
ALTER TABLE "ExportPurchase" DROP CONSTRAINT "ExportPurchase_siteId_fkey";

-- AddForeignKey
ALTER TABLE "ExportPurchase" ADD CONSTRAINT "ExportPurchase_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
