-- Records a Lemon Squeezy revocation that arrived before the order it revokes, so the
-- later order_created cannot grant export access to an already-refunded order. No
-- foreign keys: a refund payload carries no user or site id.
CREATE TABLE "RevokedLsOrder" (
    "lsOrderId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedLsOrder_pkey" PRIMARY KEY ("lsOrderId")
);
