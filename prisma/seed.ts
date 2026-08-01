import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DATABASE_URL is not set — nothing to seed.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

/** Days from now, so a checked-in seed cannot ship codes that are already expired. */
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const codes = [
    { code: "PHHUNT", discountPct: 30, maxUses: 500, expiresAt: daysFromNow(90), active: true },
    { code: "LAUNCH30", discountPct: 30, maxUses: 200, expiresAt: daysFromNow(90), active: true },
  ];

  for (const c of codes) {
    await db.promoCode.upsert({
      where: { code: c.code },
      // Sync the fields on re-run. An empty update made the seed a no-op against existing
      // rows, so a code that had expired could never be repaired by re-seeding.
      update: {
        discountPct: c.discountPct,
        maxUses: c.maxUses,
        expiresAt: c.expiresAt,
        active: c.active,
      },
      create: c,
    });
    console.log(`✓ Upserted promo code: ${c.code} (${c.discountPct}% off, expires ${c.expiresAt.toISOString()})`);
  }
}

main()
  .catch((err) => {
    console.error("✗ Seed failed:", err);
    // Without this the process still exited 0, so a deploy pipeline reported success
    // while the database had no promo codes at all.
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
