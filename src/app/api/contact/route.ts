import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  topic: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  // Unauthenticated on purpose — a contact form is reachable before sign-in. Rate limited
  // by IP so it can't be used to flood the table.
  const rl = await rateLimit(getClientIp(req), { bucket: "contact", limit: 5, windowMs: 3_600_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in every field with valid details." }, { status: 400 });
  }

  try {
    await db.contactMessage.create({ data: parsed.data });
  } catch (err) {
    logger.error("contact message create failed", { err });
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
