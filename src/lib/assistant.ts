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

/**
 * How the work is divided.
 *
 * One call per whole document does not fit in a request. sarvam-105b reasons before it
 * answers, and measured against the live API a single section took 13-21s while a
 * nine-section site in Hindi ran past 50s and was aborted. Sections are therefore
 * rewritten a few at a time, in parallel, so wall time tracks the batch rather than the
 * length of the site. Spacers carry no copy and are never sent at all.
 *
 * MAX_SECTIONS_IN follows from the rest: BATCH_SIZE * CONCURRENCY sections per wave, and
 * two waves inside the route's own time budget.
 */
export const BATCH_SIZE = 3;
export const CONCURRENCY = 4;
export const MAX_SECTIONS_IN = 24;

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
    "You are given one instruction, the whole site's copy for context, and the numbered",
    "sections you must rewrite. Reply with ONLY a JSON array holding one object per",
    "section you were asked to rewrite, in the order they were given. No prose.",
    "",
    "Rules:",
    `- Only these fields: ${EDITABLE_FIELDS.join(", ")}. Omit a field to leave it alone.`,
    "- Never invent statistics, customer counts, review scores, funding rounds or",
    "  certifications, and never name a real company. Whoever publishes this site has to",
    "  be able to stand behind every sentence.",
    "- Keep a heading under 80 characters and a body under 300.",
    "- Answer in the language the instruction is written in, unless it says otherwise.",
    "- The context is there so your wording stays consistent across the whole site.",
    "  Rewrite only the sections you were asked for.",
    "",
    "Do not explain yourself or think out loud. Emit the array and stop.",
  ].join("\n");
}

/** The copy of the whole site, so a batch stays consistent with the sections around it. */
function siteContext(sections: Section[]): string {
  return sections
    .map((s, i) =>
      s.kind === "spacer"
        ? `${i}. (spacer)`
        : `${i}. ${[s.eyebrow, s.heading, s.body, s.ctaLabel].filter(Boolean).join(" / ")}`
    )
    .join("\n");
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

export function buildRequestBody(
  sections: Section[],
  batch: { index: number; section: Section }[],
  instruction: string,
  model: string
) {
  const asked = batch
    .map(({ index, section }) => `Section ${index}: ${JSON.stringify(copyOf(section))}`)
    .join("\n");
  return {
    model,
    temperature: 0.3,
    max_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content:
          `Instruction: ${instruction}\n\n` +
          `The whole site, for context:\n${siteContext(sections)}\n\n` +
          `Rewrite these ${batch.length} section(s), and return exactly ${batch.length} object(s):\n${asked}`,
      },
    ],
  };
}

/** Just the four fields the model is allowed to see itself changing. */
function copyOf(section: Section): Record<string, string> {
  const out: Record<string, string> = {};
  if (section.eyebrow) out.eyebrow = section.eyebrow;
  if (section.heading) out.heading = section.heading;
  if (section.body) out.body = section.body;
  if (section.ctaLabel) out.ctaLabel = section.ctaLabel;
  return out;
}

type Batch = { index: number; section: Section }[];

type BatchResult =
  | { ok: true; copy: Section[] }
  | { ok: false; status: number; error: string; diagnostic?: Record<string, unknown> };

/** One call: a few sections in, the same number of copy objects out. */
async function rewriteBatch(
  sections: Section[],
  batch: Batch,
  instruction: string,
  opts: RewriteOptions
): Promise<BatchResult> {
  const doFetch = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(completionsUrl(opts.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildRequestBody(sections, batch, instruction, opts.model ?? "sarvam-105b")
      ),
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
  if (parsed.data.length !== batch.length) {
    return {
      ok: false,
      status: 422,
      error: "The assistant rewrote the wrong number of sections, so the edit was rejected.",
    };
  }

  return { ok: true, copy: parsed.data };
}

/** Run `jobs` with at most `limit` in flight, preserving order. */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out = new Array<T>(jobs.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= jobs.length) return;
      out[i] = await jobs[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

export type RewriteOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export async function rewriteSections(
  sections: Section[],
  instruction: string,
  opts: RewriteOptions
): Promise<AssistantResult> {
  if (sections.length > MAX_SECTIONS || sections.length > MAX_SECTIONS_IN) {
    return { ok: false, status: 400, error: "That is more sections than one rewrite can carry." };
  }

  // Spacers render nothing, so sending them would spend a call to be told so.
  const targets = sections
    .map((section, index) => ({ index, section }))
    .filter(({ section }) => section.kind !== "spacer");
  if (targets.length === 0) return { ok: true, sections };

  const batches: Batch[] = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    batches.push(targets.slice(i, i + BATCH_SIZE));
  }

  const results = await pooled(
    batches.map((batch) => () => rewriteBatch(sections, batch, instruction, opts)),
    CONCURRENCY
  );

  // A half-rewritten site is worse than an unchanged one, so one bad batch fails the
  // whole edit and the editor's document is left exactly as it was.
  const failure = results.find((r) => !r.ok);
  if (failure && !failure.ok) return failure;

  const byIndex = new Map<number, Section>();
  results.forEach((result, b) => {
    if (!result.ok) return;
    batches[b].forEach(({ index }, withinBatch) => {
      const from = result.copy[withinBatch];
      if (from) byIndex.set(index, from);
    });
  });

  return {
    ok: true,
    sections: sections.map((section, i) => {
      const from = byIndex.get(i);
      return from ? mergeCopyOnly([section], [from])[0] : section;
    }),
  };
}
