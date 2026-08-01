import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const MAX_BODY_BYTES = 1_000_000;
const MAX_MODEL_UPDATES = 50;

const chatEditSchema = z.object({
  message: z.string().min(1).max(2000),
  selectedSectionId: z.string().max(100),
  sections: z.array(z.object({
    id: z.string().max(100),
    heading: z.string().max(500).optional(),
    body: z.string().max(5000).optional(),
    eyebrow: z.string().max(200).optional(),
    ctaLabel: z.string().max(200).optional(),
    ctaHref: z.string().max(2000).optional(),
    accentColor: z.string().max(50).optional(),
    headingColor: z.string().max(50).optional(),
    bodyColor: z.string().max(50).optional(),
    scrollHeight: z.number().optional(),
    textAlign: z.string().max(20).optional(),
  })).max(50),
});

interface Section {
  id: string;
  heading?: string;
  body?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  accentColor?: string;
  headingColor?: string;
  bodyColor?: string;
  scrollHeight?: number;
  textAlign?: string;
}

// The model's output is applied straight to the user's document, so it is
// treated as untrusted input: only these fields, types and ranges get through.
const sectionIdSchema = z.string().min(1).max(100);
const colorSchema = z.string().max(50)
  .regex(/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/]+\)|[a-zA-Z]{3,20})$/);
const ctaHrefSchema = z.string().max(2000)
  .refine(v => v === "" || /^(?:#|\/|\.{1,2}\/|https?:\/\/|mailto:|tel:)/i.test(v));

const modelUpdateSchema = z.discriminatedUnion("field", [
  z.object({ id: sectionIdSchema, field: z.literal("heading"), value: z.string().max(500) }),
  z.object({ id: sectionIdSchema, field: z.literal("body"), value: z.string().max(5000) }),
  z.object({ id: sectionIdSchema, field: z.literal("eyebrow"), value: z.string().max(200) }),
  z.object({ id: sectionIdSchema, field: z.literal("ctaLabel"), value: z.string().max(200) }),
  z.object({ id: sectionIdSchema, field: z.literal("ctaHref"), value: ctaHrefSchema }),
  z.object({ id: sectionIdSchema, field: z.literal("accentColor"), value: colorSchema }),
  z.object({ id: sectionIdSchema, field: z.literal("headingColor"), value: colorSchema }),
  z.object({ id: sectionIdSchema, field: z.literal("bodyColor"), value: colorSchema }),
  z.object({ id: sectionIdSchema, field: z.literal("textAlign"), value: z.enum(["left", "center", "right"]) }),
  z.object({ id: sectionIdSchema, field: z.literal("scrollHeight"), value: z.number().int().min(100).max(20_000) }),
]);

const modelResponseSchema = z.object({
  message: z.string().optional(),
  updates: z.array(z.unknown()).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatEditSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { message, sections, selectedSectionId } = parsed.data;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Demo fallback — rule-based edits
    return demoEdit(message, sections, selectedSectionId);
  }

  const selectedSection = sections.find((s: Section) => s.id === selectedSectionId);

  const systemPrompt = `You are an AI assistant helping a user edit their scroll website sections.
Current selected section: ${JSON.stringify(selectedSection, null, 2)}
All sections: ${JSON.stringify(sections, null, 2)}

The user will ask you to edit the website. You MUST respond with valid JSON in this exact format:
{
  "message": "Brief friendly description of what you changed",
  "updates": [
    { "id": "section-id", "field": "heading", "value": "New value" },
    ...
  ]
}

Valid fields: heading, body, eyebrow, ctaLabel, ctaHref, accentColor, headingColor, bodyColor, scrollHeight, textAlign
For colors use hex values. For textAlign use "left", "center", or "right".
Only include updates that actually change something. Keep edits focused and relevant.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // A response truncated by max_tokens is invalid JSON, which lands in the catch
        // below and silently degrades to the rule-based path — give it room.
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const modelResponse = modelResponseSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!modelResponse.success) throw new Error("Malformed model response");

    const knownIds = new Set(sections.map((s: Section) => s.id));
    const updates: z.infer<typeof modelUpdateSchema>[] = [];
    for (const candidate of modelResponse.data.updates ?? []) {
      if (updates.length >= MAX_MODEL_UPDATES) break;
      const update = modelUpdateSchema.safeParse(candidate);
      if (update.success && knownIds.has(update.data.id)) updates.push(update.data);
    }

    return NextResponse.json({
      message: (modelResponse.data.message ?? "").slice(0, 1000) || "Done!",
      updates,
    });
  } catch (err) {
    // Falling back to the keyword rules is good resilience, but doing it silently is
    // not: the user asked the AI for an edit, got a rule-based one, and had no way to
    // tell. Log it, and mark the response so the client can say the AI was unavailable.
    logger.error("chat-edit: AI request failed, using rule-based fallback", { error: String(err) });
    return demoEdit(message, sections, selectedSectionId, true);
  }
}

function demoEdit(message: string, sections: Section[], selectedSectionId: string, aiUnavailable = false) {
  const lower = message.toLowerCase();
  const section = sections.find((s: Section) => s.id === selectedSectionId) || sections[0];
  if (!section) return NextResponse.json({ message: "No section selected", updates: [], aiUnavailable });

  const updates: { id: string; field: string; value: string | number }[] = [];
  let reply = "";

  if (lower.includes("purple") || lower.includes("violet")) {
    updates.push({ id: section.id, field: "accentColor", value: "#a78bfa" });
    updates.push({ id: section.id, field: "headingColor", value: "#ffffff" });
    reply = "Switched to a purple color scheme.";
  } else if (lower.includes("blue")) {
    updates.push({ id: section.id, field: "accentColor", value: "#60a5fa" });
    reply = "Applied a blue accent.";
  } else if (lower.includes("green") || lower.includes("emerald")) {
    updates.push({ id: section.id, field: "accentColor", value: "#34d399" });
    reply = "Applied an emerald green accent.";
  } else if (lower.includes("bigger") || lower.includes("taller") || lower.includes("more scroll")) {
    updates.push({ id: section.id, field: "scrollHeight", value: (section.scrollHeight || 1000) + 500 });
    reply = "Increased the scroll height of this section.";
  } else if (lower.includes("smaller") || lower.includes("shorter")) {
    updates.push({ id: section.id, field: "scrollHeight", value: Math.max(300, (section.scrollHeight || 1000) - 400) });
    reply = "Reduced the scroll height.";
  } else if (lower.includes("center")) {
    updates.push({ id: section.id, field: "textAlign", value: "center" });
    reply = "Centered the text alignment.";
  } else if (lower.includes("left align")) {
    updates.push({ id: section.id, field: "textAlign", value: "left" });
    reply = "Left-aligned the text.";
  } else if (lower.includes("heading") || lower.includes("title")) {
    const match = message.match(/(?:heading|title)[^\w"']*["']?([^"'\n]+)["']?/i);
    if (match) {
      updates.push({ id: section.id, field: "heading", value: match[1].trim() });
      reply = `Updated the heading to "${match[1].trim()}".`;
    } else {
      reply = "To change the heading, say something like: 'Set the heading to Your New Title'";
    }
  } else if (lower.includes("cta") || lower.includes("button")) {
    const match = message.match(/(?:cta|button)[^\w"']*["']?([^"'\n]+)["']?/i);
    if (match) {
      updates.push({ id: section.id, field: "ctaLabel", value: match[1].trim() });
      reply = `Updated the CTA button to "${match[1].trim()}".`;
    } else {
      reply = "To change the button text, say: 'Set the CTA to Get Started'";
    }
  } else {
    reply = "I can help you change colors, text alignment, scroll height, headings, and button labels. Try: 'Make it purple', 'Center the text', 'Make the section taller'.";
  }

  return NextResponse.json({ message: reply, updates, aiUnavailable });
}
