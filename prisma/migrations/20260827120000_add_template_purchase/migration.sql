-- A premium template bought outright. Keyed by slug because the catalogue lives in code,
-- so a purchase survives a template being renamed or withdrawn from the gallery.
CREATE TABLE "TemplatePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateSlug" TEXT NOT NULL,
    "lsOrderId" TEXT NOT NULL,
    "lsCheckoutId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ExportPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplatePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplatePurchase_lsOrderId_key" ON "TemplatePurchase"("lsOrderId");
CREATE UNIQUE INDEX "TemplatePurchase_userId_templateSlug_status_key" ON "TemplatePurchase"("userId", "templateSlug", "status");
CREATE INDEX "TemplatePurchase_userId_idx" ON "TemplatePurchase"("userId");
CREATE INDEX "TemplatePurchase_templateSlug_idx" ON "TemplatePurchase"("templateSlug");

ALTER TABLE "TemplatePurchase" ADD CONSTRAINT "TemplatePurchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
