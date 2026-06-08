import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };

// Cap connections per serverless instance so we don't exhaust Postgres under load.
// Vercel spins up many concurrent functions; keeping this low prevents connection storms.
const POOL_MAX = parseInt(process.env.DB_POOL_MAX ?? "5", 10);

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://localhost/scrollcraft";
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
