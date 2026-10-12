import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { sectionsSchema, themeSchema, siteStyleSchema } from "@/lib/siteSchema";
import { BRIEF_RULES, briefSchema, briefToSite, checkBriefInput } from "@/lib/siteBrief";

/**
 * A description in, a site out.
 *
 * Every cap here is about money as much as safety. The credits behind this are finite,
 * images are the expensive part of the input, and a loop on the client or a bored
 * stranger with curl can spend a month's budget in an afternoon. So: a short description,
 * at most three images, a bounded answer, a rate limit per address, and a ceiling on how
 * many sites the whole service will generate in a day.
 */

const MODEL = "claude-opus-5-5";
const MAX_OUTPUT_TOKENS = 8000;
/** Enough to hold the rules, three photographs and the answer. */
const MAX_BODY_BYTES = 7_000_000;

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

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Those photographs are too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const input = checkBriefInput(body as { description?: unknown; images?: unknown });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = [
    ...input.images.map(
      (image): Anthropic.ContentBlockParam => ({
        type: "image",
        // checkBriefInput has already restricted this to the four types the API accepts.
        source: { type: "base64", media_type: image.media_type as Anthropic.Base64ImageSource["media_type"], data: image.data },
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
      return NextResponse.json({ error: "That description could not be turned into a site. Try describing the business plainly." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
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
      return NextResponse.json({ error: "The site came back malformed. Try again." }, { status: 502 });
    }

    const usage = response.usage;
    logger.info("generate-site", {
      inputTokens: usage.input_tokens,
      cachedTokens: usage.cache_read_input_tokens,
      outputTokens: usage.output_tokens,
      images: input.images.length,
    });

    return NextResponse.json({
      siteName: site.siteName,
      siteDescription: site.siteDescription,
      style: style.data,
      theme: theme.data,
      sections: sections.data,
    });
  } catch (err) {
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
