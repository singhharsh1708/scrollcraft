-- CreateEnum
CREATE TYPE "ExportPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "ExportPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "lsOrderId" TEXT NOT NULL,
    "lsCheckoutId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ExportPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportPurchase_lsOrderId_key" ON "ExportPurchase"("lsOrderId");

-- CreateIndex
CREATE INDEX "ExportPurchase_userId_idx" ON "ExportPurchase"("userId");

-- CreateIndex
CREATE INDEX "ExportPurchase_siteId_idx" ON "ExportPurchase"("siteId");

-- AddForeignKey
ALTER TABLE "ExportPurchase" ADD CONSTRAINT "ExportPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportPurchase" ADD CONSTRAINT "ExportPurchase_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
