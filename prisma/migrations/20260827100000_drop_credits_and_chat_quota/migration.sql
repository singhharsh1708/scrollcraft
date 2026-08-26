-- The AI features these metered were removed in the template-library pivot: nothing
-- consumed credits, and nothing read the chat quota columns at all.
ALTER TABLE "User" DROP COLUMN "credits";
ALTER TABLE "User" DROP COLUMN "chatEditsUsed";
ALTER TABLE "User" DROP COLUMN "chatPeriodStart";
