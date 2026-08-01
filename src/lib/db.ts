import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };

// Cap connections per serverless instance so we don't exhaust Postgres under load.
// Vercel spins up many concurrent functions; keeping this low prevents connection storms.
// Read through env rather than process.env: a variable that is set but blank arrives as
// "", which is not nullish, so `?? "5"` kept it and parseInt("") gave NaN — pg-pool then
// falls back to its own default of 10, doubling the cap this is meant to hold down.
const POOL_MAX = env.DB_POOL_MAX ?? 5;

function createClient(): PrismaClient {
  const connectionString = env.DATABASE_URL ?? "postgresql://localhost/scrollcraft";
  // Pass a PoolConfig so we control max connections per serverless instance.
  // Keeps Postgres from being overwhelmed when Vercel scales horizontally.
  const adapter = new PrismaPg({ connectionString, max: POOL_MAX });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as GlobalWithPrisma;
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
