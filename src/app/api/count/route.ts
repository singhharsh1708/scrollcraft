import { NextResponse, type NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { FUNNEL_EVENTS, type FunnelEvent } from "@/lib/funnel";
import { TEMPLATES } from "@/lib/templates";

/**
 * The four counts that say whether anyone finishes a site.
 *
 * Vercel keeps custom events behind its Pro plan, so they are kept here instead, in the
 * Redis this app already uses for rate limiting. Counts only, keyed by day: the event
 * name must be one of four, the template must be a slug that exists in the catalogue, and
 * nothing a person typed is accepted at all.
 */

const TTL_SECONDS = 400 * 24 * 60 * 60;
/** Longer than any export has taken, short enough that a stuck tab cannot skew the mean. */
const MAX_EXPORT_SECONDS = 600;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const slugs = new Set(TEMPLATES.map((t) => t.slug));

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Keys are scoped by deployment, so a preview build and a local run cannot inflate the
 * numbers the owner reads. Only production writes to the unprefixed keys.
 */
function scope(): string {
  return process.env.VERCEL_ENV === "production" ? "" : `${process.env.VERCEL_ENV || "dev"}:`;
}

/**
 * Read the counts back.
 *
 * Needs FUNNEL_TOKEN, and answers 404 without one: adoption numbers are the owner's to
 * publish, and a route that exists but refuses tells a stranger it is there.
 */
export async function GET(req: NextRequest) {
  const token = process.env.FUNNEL_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) return new NextResponse(null, { status: 404 });

  const store = getRedis();
  if (!store) return NextResponse.json({ error: "No store configured." }, { status: 503 });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 7, 1), 90);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const totals: Record<FunnelEvent, number> = { editor_opened: 0, first_edit: 0, export_started: 0, export_finished: 0 };
  let secondsSum = 0;
  let secondsN = 0;
  const byTemplate: Record<string, number> = {};

  try {
    for (const date of dates) {
      const prefix = `funnel:${scope()}${date}`;
      for (const event of FUNNEL_EVENTS) {
        totals[event] += Number(await store.get(`${prefix}:${event}`)) || 0;
      }
      secondsSum += Number(await store.get(`${prefix}:export_finished_seconds_sum`)) || 0;
      secondsN += Number(await store.get(`${prefix}:export_finished_seconds_n`)) || 0;
      for (const slug of [...slugs, "custom"]) {
        const n = Number(await store.get(`${prefix}:editor_opened:${slug}`)) || 0;
        if (n) byTemplate[slug] = (byTemplate[slug] ?? 0) + n;
      }
    }
  } catch {
    return NextResponse.json({ error: "Could not read the counts." }, { status: 503 });
  }

  return NextResponse.json({
    days,
    ...totals,
    finishedPerOpened: totals.editor_opened ? Number((totals.export_finished / totals.editor_opened).toFixed(3)) : null,
    meanExportSeconds: secondsN ? Number((secondsSum / secondsN).toFixed(1)) : null,
    byTemplate,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getClientIp(req), { bucket: "count", limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: { event?: unknown; template?: unknown; seconds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const event = body.event;
  if (typeof event !== "string" || !FUNNEL_EVENTS.includes(event as FunnelEvent)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }

  const store = getRedis();
  if (!store) return new NextResponse(null, { status: 204 });

  const date = today();
  const prefix = `funnel:${scope()}${date}`;
  const increments: [key: string, by: number][] = [[`${prefix}:${event}`, 1]];

  if (event === "editor_opened") {
    const slug = typeof body.template === "string" && slugs.has(body.template) ? body.template : "custom";
    increments.push([`${prefix}:editor_opened:${slug}`, 1]);
  }

  // A sum and a count, so the mean can be read back without a key per export.
  if (event === "export_finished") {
    const seconds = Number(body.seconds);
    if (Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_EXPORT_SECONDS) {
      increments.push([`${prefix}:export_finished_seconds_sum`, Math.round(seconds)]);
      increments.push([`${prefix}:export_finished_seconds_n`, 1]);
    }
  }

  try {
    for (const [key, by] of increments) {
      const total = by === 1 ? await store.incr(key) : await store.incrby(key, by);
      // Only the first write needs it, and re-setting it would slide the window forward.
      if (total === by) await store.expire(key, TTL_SECONDS);
    }
  } catch {
    // A counter is never worth failing someone's export over.
  }

  return new NextResponse(null, { status: 204 });
}
