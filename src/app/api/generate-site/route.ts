import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Redis } from "@upstash/redis";
import { accountIdentity } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { redisCredentials } from "@/lib/redisCredentials";
import { logger } from "@/lib/logger";
import { sectionsSchema, themeSchema, siteStyleSchema } from "@/lib/siteSchema";
import { BRIEF_RULES, briefSchema, briefToSite, checkBriefInput } from "@/lib/siteBrief";
import { BROWSER_COOKIE, PACK_PRICE_USD, PACK_SITES, balanceOf, browserTokenFrom, cookieOptions, keyHashFrom, takeAllowance } from "@/lib/credits";

/**
 * A description in, a site out.
 *
 * Every cap here is about money as much as safety. The credits behind this are finite,
 * images are the expensive part of the input, and a loop on the client or a bored
 * stranger with curl can spend a month's budget in an afternoon. So: a short description,
 * at most three images, a bounded answer, a rate limit per address, and a ceiling for the
 * whole service, because twenty a day per address is no ceiling at all once there are
 * twenty addresses.
 */

const MODEL = "claude-opus-5-5";
const MAX_OUTPUT_TOKENS = 8000;
/** Enough to hold the rules, three photographs and the answer. */
const MAX_BODY_BYTES = 7_000_000;
/** Sites the whole deployment will write in a day, whoever asks. */
const DAILY_CEILING = Number(process.env.GENERATE_DAILY_LIMIT || 150);

let redis: Redis | null = null;

/**
 * The service-wide count for today, incremented before the call.
 *
 * Returns null when there is no store, which is also what a local run looks like: there
 * the per-address limits are the only ones, and that is said plainly rather than being
 * presented as a ceiling that is not there.
 */
async function todaysSpendCount(): Promise<number | null> {
  const credentials = redisCredentials();
  if (!credentials) return null;
  if (!redis) redis = new Redis(credentials);
  const key = `generate:count:${new Date().toISOString().slice(0, 10)}`;
  try {
    const total = await redis.incr(key);
    if (total === 1) await redis.expire(key, 40 * 24 * 60 * 60);
    return total;
  } catch {
    return null;
  }
}

/** Read the body with a running cap: content-length is whatever the sender claims. */
async function readCapped(req: NextRequest, limit: number): Promise<string | null> {
  const body = req.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let seen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    seen += value.byteLength;
    if (seen > limit) return null;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

export const maxDuration = 120;

function configured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function POST(req: NextRequest) {
  if (!configured()) {
    return NextResponse.json({ error: "Site generation is not configured on this deployment." }, { status: 503 });
  }

  const ip = getClientIp(req);
  // Deliberately tight: this is the one route that costs real money per call.
  const perMinute = await rateLimit(ip, { bucket: "generate-site", limit: 3, windowMs: 60_000 });
  if (!perMinute.allowed) {
    return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  }
  const perDay = await rateLimit(ip, { bucket: "generate-site-day", limit: 20, windowMs: 24 * 60 * 60_000 });
  if (!perDay.allowed) {
    return NextResponse.json({ error: "That is as many sites as one person can generate in a day." }, { status: 429 });
  }

  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: "Those photographs are too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const input = checkBriefInput(body as { description?: unknown; images?: unknown });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  // Counted before the call rather than after it, so a crash mid-request still costs the
  // budget a slot, which is the honest direction to be wrong in.
  const today = await todaysSpendCount();
  if (today !== null && today > DAILY_CEILING) {
    return NextResponse.json(
      { error: "This has written as many sites as it can today. Try again tomorrow." },
      { status: 503 }
    );
  }

  // One site's worth of allowance, taken before the call and given back if the call
  // does not produce a site. Nobody should pay for a 502.
  // A signed-in visitor spends their account's credits, which is what makes them reach
  // the same person in a second browser. Everybody else spends the key cookie's.
  const identity = (await accountIdentity()) ?? keyHashFrom(req);
  // The free site stays with the browser either way: one person signed in on three
  // machines is still one free site each, not one per account per browser.
  const browser = browserTokenFrom(req) ?? crypto.randomUUID();
  const remember = (response: NextResponse) => {
    response.cookies.set(BROWSER_COOKIE, browser, cookieOptions());
    return response;
  };
  const allowance = await takeAllowance(ip, identity, browser);
  if (!allowance.ok) {
    if (allowance.reason === "unavailable") {
      return NextResponse.json({ error: "Site generation is unavailable for a moment. Try again shortly." }, { status: 503 });
    }
    if (allowance.reason === "address-busy") {
      return remember(NextResponse.json(
        { error: "That is as many free sites as this connection can have this month. A pack of 5 is $20.", needsCredits: true },
        { status: 402 }
      ));
    }
    // Read back rather than taken from the refusal: somebody who signed in and has never
    // bought anything has an identity but no pack, and must not be told credits are spent.
    const bought = identity ? (await balanceOf(identity))?.total ?? 0 : 0;
    return remember(NextResponse.json(
      {
        error:
          bought > 0
            ? `Those credits are spent. Another ${PACK_SITES} sites cost $${PACK_PRICE_USD}.`
            : `The free site has been used from this connection. ${PACK_SITES} more cost $${PACK_PRICE_USD}.`,
        needsCredits: true,
      },
      { status: 402 }
    ));
  }

  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = [
    ...input.images.map(
      (image): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: image.media_type, data: image.data },
      })
    ),
    { type: "text", text: `Here is the business:\n\n${input.description}` },
  ];

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // The rules never change, so they are cached and cost a tenth on every call after
      // the first. Nothing variable may appear before this point.
      system: [{ type: "text", text: BRIEF_RULES, cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(briefSchema), effort: "medium" },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      logger.warn("generate-site declined", { category: response.stop_details?.category });
      await allowance.release();
      return NextResponse.json({ error: "That description could not be turned into a site. Try describing the business plainly." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      await allowance.release();
      return NextResponse.json({ error: "The site came back incomplete. Try a shorter description." }, { status: 502 });
    }

    const site = briefToSite(response.parsed_output);

    // The model's answer is schema-valid by construction; this is the editor's own
    // validation, which is stricter and is what everything downstream relies on.
    const sections = sectionsSchema.safeParse(site.sections);
    const theme = themeSchema.safeParse(site.theme);
    const style = siteStyleSchema.safeParse(site.style);
    if (!sections.success || !theme.success || !style.success) {
      logger.warn("generate-site produced something the editor would not accept", {
        sections: sections.success ? null : sections.error.issues[0]?.message,
        theme: theme.success ? null : theme.error.issues[0]?.message,
        style: style.success ? null : style.error.issues[0]?.message,
      });
      await allowance.release();
      return NextResponse.json({ error: "The site came back malformed. Try again." }, { status: 502 });
    }

    const usage = response.usage;
    logger.info("generate-site", {
      inputTokens: usage.input_tokens,
      cachedTokens: usage.cache_read_input_tokens,
      outputTokens: usage.output_tokens,
      images: input.images.length,
      todayAcrossEveryone: today,
      paid: allowance.kind === "paid",
    });

    const left = identity ? (await balanceOf(identity))?.remaining ?? 0 : 0;
    return remember(NextResponse.json({
      remaining: left,
      usedFreeSite: allowance.kind === "free",
      siteName: site.siteName,
      siteDescription: site.siteDescription,
      style: style.data,
      theme: theme.data,
      sections: sections.data,
    }));
  } catch (err) {
    await allowance.release();
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Busy right now. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      logger.error("generate-site credentials rejected", { err });
      return NextResponse.json({ error: "Site generation is not configured on this deployment." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      logger.error("generate-site upstream error", { status: err.status, message: err.message });
      return NextResponse.json({ error: "Could not generate a site just now." }, { status: 502 });
    }
    logger.error("generate-site failed", { err });
    return NextResponse.json({ error: "Could not generate a site just now." }, { status: 500 });
  }
}
