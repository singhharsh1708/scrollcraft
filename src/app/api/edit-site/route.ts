import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sectionsSchema } from "@/lib/siteSchema";
import { MAX_INSTRUCTION_CHARS, MAX_SECTIONS_IN, rewriteSections } from "@/lib/assistant";

/**
 * Rewrite a site's copy from a plain-language instruction.
 *
 * Only reachable when a key is configured. The editor asks first with GET, and hides the
 * panel entirely when the answer is no, because a button that cannot do the thing it
 * offers is worse than no button.
 */

// A 105B model rewriting a whole site takes tens of seconds, well past the platform's
// default function budget. Aborting at 50s means the caller gets this route's own error
// rather than an opaque gateway timeout.
export const maxDuration = 60;
const REQUEST_TIMEOUT_MS = 50_000;

const configured = () => Boolean(env.SARVAM_API_KEY);

export async function GET() {
  return NextResponse.json(
    { available: configured() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** The body, or null once it exceeds `limit` — at which point reading stops. */
async function readCapped(req: NextRequest, limit: number): Promise<string | null> {
  const body = req.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let seen = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      if (seen > limit) return null;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return out + decoder.decode();
}

export async function POST(req: NextRequest) {
  if (!configured()) {
    return NextResponse.json(
      { error: "This instance has no assistant configured." },
      { status: 503 }
    );
  }

  // Tighter than the export bucket: an export costs CPU, a rewrite costs credit that
  // runs out for everyone at once.
  const rl = await rateLimit(getClientIp(req), {
    bucket: "edit-site",
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many rewrites. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const MAX_BODY = 400_000;
  const declaredLen = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const raw = await readCapped(req, MAX_BODY);
  if (raw === null) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { sections: rawSections, instruction: rawInstruction } = (body ?? {}) as {
    sections?: unknown;
    instruction?: unknown;
  };

  const instruction = typeof rawInstruction === "string" ? rawInstruction.trim() : "";
  if (!instruction) {
    return NextResponse.json({ error: "Say what you would like changed." }, { status: 400 });
  }
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return NextResponse.json(
      { error: `Keep the instruction under ${MAX_INSTRUCTION_CHARS} characters.` },
      { status: 400 }
    );
  }

  const parsed = sectionsSchema.safeParse(rawSections);
  if (!parsed.success) {
    return NextResponse.json({ error: "Those sections are not valid." }, { status: 400 });
  }
  if (parsed.data.length === 0) {
    return NextResponse.json({ error: "There is nothing to rewrite yet." }, { status: 400 });
  }
  if (parsed.data.length > MAX_SECTIONS_IN) {
    return NextResponse.json(
      { error: `The assistant handles up to ${MAX_SECTIONS_IN} sections at a time.` },
      { status: 400 }
    );
  }

  const result = await rewriteSections(parsed.data, instruction, {
    apiKey: env.SARVAM_API_KEY as string,
    model: env.SARVAM_MODEL || undefined,
    baseUrl: env.SARVAM_BASE_URL || undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!result.ok) {
    // The instruction and the copy are the user's; only the shape of the failure is ours
    // to record.
    logger.warn("edit-site rewrite failed", { status: result.status });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { sections: result.sections },
    { headers: { "Cache-Control": "no-store" } }
  );
}
