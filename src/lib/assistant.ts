import "server-only";

import { MAX_SECTIONS, sectionsSchema, type Section } from "@/lib/siteSchema";

/**
 * The editor's assistant: a plain-language instruction in, rewritten copy out.
 *
 * The model is not trusted with the document. It is asked for JSON, and whatever comes
 * back is parsed, validated against the editor's own section schema, and then reduced to
 * the four copy fields before it reaches the caller. A reply that drops a layout, moves a
 * section or invents a field cannot damage anything, because only the words are taken.
 */

export const SARVAM_DEFAULT_BASE_URL = "https://api.sarvam.ai/v1";

/** `<base>/chat/completions`, with any number of trailing slashes on the base. */
export function completionsUrl(baseUrl?: string): string {
  return `${(baseUrl || SARVAM_DEFAULT_BASE_URL).replace(/\/+$/, "")}/chat/completions`;
}

/** Bounds on what one request may cost, since credits are finite and per-key. */
export const MAX_INSTRUCTION_CHARS = 600;
export const MAX_SECTIONS_IN = 40;

/**
 * Output budget for one completion.
 *
 * sarvam-105b reasons before it answers, and the API's own default of 2048 was not enough
 * to hold the reasoning and the rewritten JSON together: every request finished with
 * `finish_reason: "length"`, 2048 tokens of `reasoning_content` and a null `content`. A
 * cap only bills what the model actually generates, so this is set well clear of the
 * whole document rather than tuned tightly.
 */
export const MAX_COMPLETION_TOKENS = 16_384;

export type AssistantResult =
  | { ok: true; sections: Section[] }
  | { ok: false; status: number; error: string; diagnostic?: Record<string, unknown> };

/** The upstream shape, as much of it as this module reads. */
type Completion = {
  choices?: {
    finish_reason?: unknown;
    message?: Record<string, unknown>;
  }[];
  usage?: Record<string, unknown>;
};

/**
 * Why a completion could not be used, in field names and lengths only.
 *
 * A 502 saying "the assistant returned nothing" is unactionable on its own: it cannot
 * distinguish a model that stopped early from one that put its answer in a field this
 * code does not read. None of the copy itself goes in here.
 */
export function describeCompletion(json: Completion): Record<string, unknown> {
  const choice = json?.choices?.[0];
  const message = choice?.message ?? {};
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(message)) {
    fields[key] = typeof value === "string" ? `string(${value.length})` : typeof value;
  }
  return {
    choices: Array.isArray(json?.choices) ? json.choices.length : 0,
    finishReason: choice?.finish_reason ?? null,
    messageFields: fields,
    usage: json?.usage ?? null,
  };
}

/** The fields the assistant may touch. Everything else is the editor's to set. */
const EDITABLE_FIELDS = ["eyebrow", "heading", "body", "ctaLabel"] as const;

export function systemPrompt(): string {
  return [
    "You rewrite the copy of a scroll-driven marketing website.",
    "",
    "You are given the site's sections as a JSON array and one instruction.",
    "Reply with ONLY the full updated JSON array. No prose, no commentary.",
    "",
    "Rules:",
    '- Return the same number of objects, in the same order, with the same "kind" values.',
    `- Only change these fields: ${EDITABLE_FIELDS.join(", ")}.`,
    "- Never invent statistics, customer counts, review scores, funding rounds or",
    "  certifications, and never name a real company. Whoever publishes this site has to",
    "  be able to stand behind every sentence.",
    '- A section whose kind is "spacer" carries no copy. Return it unchanged.',
    "- Keep a heading under 80 characters and a body under 300.",
    "- Answer in the language the instruction is written in, unless it says otherwise.",
    "",
    "Do not explain yourself or think out loud. Emit the array and stop.",
  ].join("\n");
}

/**
 * Pull the JSON array out of a completion.
 *
 * Models wrap JSON in prose and code fences however firmly you ask them not to, so the
 * array is located rather than assumed to be the whole reply.
 */
export function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("no JSON array in the reply");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Keep the structure the editor owns and take only the copy from the reply.
 */
export function mergeCopyOnly(original: Section[], proposed: Section[]): Section[] {
  return original.map((section, i) => {
    const from = proposed[i];
    if (!from || section.kind === "spacer") return section;
    const merged: Section = { ...section };
    if (typeof from.eyebrow === "string") merged.eyebrow = from.eyebrow;
    if (typeof from.heading === "string") merged.heading = from.heading;
    if (typeof from.body === "string") merged.body = from.body;
    if (typeof from.ctaLabel === "string") merged.ctaLabel = from.ctaLabel;
    return merged;
  });
}

export function buildRequestBody(sections: Section[], instruction: string, model: string) {
  return {
    model,
    temperature: 0.3,
    max_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content: `Instruction: ${instruction}\n\nSections:\n${JSON.stringify(sections)}`,
      },
    ],
  };
}

export async function rewriteSections(
  sections: Section[],
  instruction: string,
  opts: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  }
): Promise<AssistantResult> {
  const doFetch = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(completionsUrl(opts.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(sections, instruction, opts.model ?? "sarvam-105b")),
      signal: opts.signal,
    });
  } catch {
    return { ok: false, status: 502, error: "Could not reach the assistant. Try again." };
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 502, error: "The assistant is not configured correctly." };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, error: "The assistant is busy. Try again in a minute." };
    }
    return { ok: false, status: 502, error: "The assistant could not complete that." };
  }

  let json: Completion;
  try {
    json = (await res.json()) as Completion;
  } catch {
    return { ok: false, status: 502, error: "The assistant returned something unreadable." };
  }
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const diagnostic = describeCompletion(json);
    const refusal = choice?.message?.refusal;
    if (typeof refusal === "string" && refusal.trim()) {
      return { ok: false, status: 422, error: "The assistant declined that instruction.", diagnostic };
    }
    if (choice?.finish_reason === "length") {
      return {
        ok: false,
        status: 502,
        error: "That was too long for the assistant to finish. Try fewer sections at once.",
        diagnostic,
      };
    }
    return { ok: false, status: 502, error: "The assistant returned nothing.", diagnostic };
  }

  let proposed: unknown;
  try {
    proposed = extractJsonArray(content);
  } catch {
    return {
      ok: false,
      status: 422,
      error: "The assistant did not return a usable edit.",
      diagnostic: describeCompletion(json),
    };
  }

  const parsed = sectionsSchema.safeParse(proposed);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? issue.path.join(".") : "the section list";
    return { ok: false, status: 422, error: `The assistant's edit was rejected at ${where}.` };
  }
  if (parsed.data.length !== sections.length) {
    return {
      ok: false,
      status: 422,
      error: "The assistant changed how many sections the site has, so the edit was rejected.",
    };
  }
  if (parsed.data.length > MAX_SECTIONS) {
    return { ok: false, status: 422, error: "The assistant's edit was too long." };
  }

  return { ok: true, sections: mergeCopyOnly(sections, parsed.data) };
}
