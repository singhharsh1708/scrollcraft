import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main() {
  const codes = [
    {
      code: "PHHUNT",
      discountPct: 30,
      maxUses: 500,
      expiresAt: new Date("2026-07-31T23:59:59Z"),
    },
    {
      code: "LAUNCH30",
      discountPct: 30,
      maxUses: 200,
      expiresAt: new Date("2026-07-31T23:59:59Z"),
    },
  ];

  for (const c of codes) {
    await db.promoCode.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log(`✓ Upserted promo code: ${c.code} (${c.discountPct}% off)`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
