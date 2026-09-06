import { describe, it, expect, vi } from "vitest";
import {
  BATCH_SIZE,
  MAX_COMPLETION_TOKENS,
  completionsUrl,
  describeCompletion,
  extractJsonArray,
  mergeCopyOnly,
  rewriteSections,
  systemPrompt,
} from "@/lib/assistant";
import type { Section } from "@/lib/siteSchema";

/** A stub that answers every batch with the same content. */
function fetchReturning(content: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ finish_reason: "stop", message: { content } }] }),
  })) as unknown as typeof fetch;
}

/** A stub that reads the batch it was sent and rewrites each heading in it. */
function fetchEchoing(transform: (heading: string) => string) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const sent = JSON.parse(String(init.body));
    const asked = String(sent.messages[1].content);
    const headings = [...asked.matchAll(/^Section \d+: (\{.*\})$/gm)].map(
      (m) => JSON.parse(m[1]).heading ?? ""
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify(headings.map((h) => ({ heading: transform(h) }))) } },
        ],
      }),
    };
  }) as unknown as typeof fetch;
}

const calls = (f: typeof fetch) => (f as unknown as ReturnType<typeof vi.fn>).mock.calls;
const bodyOf = (f: typeof fetch, n = 0) => JSON.parse(String((calls(f)[n][1] as RequestInit).body));

const DOC: Section[] = [
  {
    id: "s1",
    kind: "text",
    layout: "left",
    reveal: "rise",
    scrollHeight: 1400,
    eyebrow: "Studio",
    heading: "Original heading",
    body: "Original body copy.",
    ctaLabel: "See the work",
    ctaHref: "#section-3",
  },
  { id: "s2", kind: "spacer", scrollHeight: 600 },
];

/** Nine sections with two spacers, the shape a real template has. */
const SITE: Section[] = Array.from({ length: 9 }, (_, i) =>
  i === 3 || i === 7
    ? { id: `s${i}`, kind: "spacer" as const, scrollHeight: 600 }
    : { id: `s${i}`, kind: "text" as const, layout: "left" as const, heading: `Heading ${i}`, ctaHref: "#a" }
);

const opts = { apiKey: "k" };

describe("extractJsonArray", () => {
  it("reads a bare array", () => {
    expect(extractJsonArray('[{"heading":"a"}]')).toEqual([{ heading: "a" }]);
  });

  it("reads an array inside a json code fence", () => {
    expect(extractJsonArray('```json\n[{"heading":"a"}]\n```')).toEqual([{ heading: "a" }]);
  });

  it("reads an array inside an unlabelled code fence", () => {
    expect(extractJsonArray('```\n[{"heading":"a"}]\n```')).toEqual([{ heading: "a" }]);
  });

  it("reads an array the model wrapped in prose", () => {
    expect(extractJsonArray('Sure! Here you go:\n[{"heading":"a"}]\nHope that helps.')).toEqual([
      { heading: "a" },
    ]);
  });

  it("throws when there is no array at all", () => {
    expect(() => extractJsonArray("I cannot help with that.")).toThrow();
  });
});

describe("mergeCopyOnly", () => {
  it("takes the copy and keeps every structural field", () => {
    const merged = mergeCopyOnly(DOC, [
      { heading: "New heading", body: "New body.", layout: "center", scrollHeight: 20_000 },
      {},
    ]);
    expect(merged[0].heading).toBe("New heading");
    expect(merged[0].body).toBe("New body.");
    expect(merged[0].layout).toBe("left");
    expect(merged[0].scrollHeight).toBe(1400);
    expect(merged[0].id).toBe("s1");
  });

  it("leaves a spacer exactly as it was", () => {
    const merged = mergeCopyOnly(DOC, [{}, { heading: "spacers have no copy" }]);
    expect(merged[1]).toEqual(DOC[1]);
  });

  it("keeps a field the reply omitted", () => {
    const merged = mergeCopyOnly(DOC, [{ heading: "New" }, {}]);
    expect(merged[0].eyebrow).toBe("Studio");
    expect(merged[0].ctaLabel).toBe("See the work");
  });
});

describe("describeCompletion", () => {
  it("names the fields the reply carried and how long each was", () => {
    const d = describeCompletion({
      choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "abc" } }],
      usage: { total_tokens: 9 },
    });
    expect(d).toEqual({
      choices: 1,
      finishReason: "length",
      messageFields: { content: "string(0)", reasoning_content: "string(3)" },
      usage: { total_tokens: 9 },
    });
  });

  it("carries no copy, only its shape", () => {
    const d = describeCompletion({ choices: [{ message: { content: "Radiance, redefined." } }] });
    expect(JSON.stringify(d)).not.toContain("Radiance");
  });

  it("survives a reply with no choices at all", () => {
    expect(describeCompletion({})).toMatchObject({ choices: 0, finishReason: null });
  });
});

describe("completionsUrl", () => {
  it("defaults to Sarvam", () => {
    expect(completionsUrl()).toBe("https://api.sarvam.ai/v1/chat/completions");
    expect(completionsUrl("")).toBe("https://api.sarvam.ai/v1/chat/completions");
  });

  it("takes a gateway that speaks the same shape", () => {
    expect(completionsUrl("http://127.0.0.1:8080/v1")).toBe(
      "http://127.0.0.1:8080/v1/chat/completions"
    );
  });

  it("does not double the slash on a base that ends in one", () => {
    expect(completionsUrl("https://gw.example.com/v1///")).toBe(
      "https://gw.example.com/v1/chat/completions"
    );
  });
});

describe("rewriteSections", () => {
  it("applies a well formed rewrite", async () => {
    const res = await rewriteSections(DOC, "make it warmer", {
      ...opts,
      fetchImpl: fetchReturning(JSON.stringify([{ heading: "Warmer heading", body: "Warmer body." }])),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sections[0].heading).toBe("Warmer heading");
    expect(res.sections).toHaveLength(2);
  });

  // The whole safety argument for the feature: the reply is copy, not a document. A model
  // that redirects the call to action, restyles the page or stretches the scroll track
  // changes nothing, because none of those fields are read back.
  it("ignores every field that is not copy, including the call to action target", async () => {
    const res = await rewriteSections(DOC, "improve it", {
      ...opts,
      fetchImpl: fetchReturning(
        JSON.stringify([
          {
            heading: "Fine",
            ctaHref: "https://example.invalid/collect",
            layout: "center",
            headingColor: "#ff0000",
            scrollHeight: 19_000,
            visible: false,
          },
        ])
      ),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sections[0].ctaHref).toBe("#section-3");
    expect(res.sections[0].layout).toBe("left");
    expect(res.sections[0].headingColor).toBeUndefined();
    expect(res.sections[0].scrollHeight).toBe(1400);
    expect(res.sections[0].visible).toBeUndefined();
  });

  it("rejects a batch that comes back the wrong length", async () => {
    const res = await rewriteSections(DOC, "trim it", {
      ...opts,
      fetchImpl: fetchReturning(JSON.stringify([{ heading: "one" }, { heading: "two" }])),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects a reply that is not JSON", async () => {
    const res = await rewriteSections(DOC, "hi", {
      ...opts,
      fetchImpl: fetchReturning("I am afraid I cannot do that."),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects a reply that is JSON but not a section list", async () => {
    const res = await rewriteSections(DOC, "hi", {
      ...opts,
      fetchImpl: fetchReturning('[{"heading": 42}]'),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects copy that exceeds what the schema allows", async () => {
    const res = await rewriteSections(DOC, "expand", {
      ...opts,
      fetchImpl: fetchReturning(JSON.stringify([{ heading: "x".repeat(501) }])),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("reports an empty completion rather than wiping the copy", async () => {
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl: fetchReturning("   ") });
    expect(res).toMatchObject({ ok: false, status: 502 });
  });

  // The bug this pins: sarvam-105b reasons before answering, and on the API's own default
  // of 2048 tokens it spent every one of them thinking and returned a null content.
  it("asks for an output budget large enough to hold reasoning and the answer", async () => {
    const fetchImpl = fetchReturning(JSON.stringify([{ heading: "ok" }]));
    await rewriteSections(DOC, "hi", { ...opts, fetchImpl });
    expect(bodyOf(fetchImpl).max_tokens).toBe(MAX_COMPLETION_TOKENS);
    expect(bodyOf(fetchImpl).max_tokens).toBeGreaterThan(2048);
  });

  it("says the reply was cut off rather than blaming an empty one", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: "length", message: { content: null, reasoning_content: "x".repeat(6683) } }],
        usage: { completion_tokens: 2048 },
      }),
    })) as unknown as typeof fetch;
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/too long/i);
    expect(res.error).not.toMatch(/returned nothing/i);
  });

  it("reports a refusal as a refusal, not as a broken reply", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: "stop", message: { content: null, refusal: "I cannot help with that." } }],
      }),
    })) as unknown as typeof fetch;
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl });
    expect(res).toMatchObject({ ok: false, status: 422 });
    if (res.ok) return;
    expect(res.error).toMatch(/declined/i);
  });

  it("says why an empty completion was empty, so a 502 is diagnosable", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "x".repeat(40) } }],
        usage: { completion_tokens: 512 },
      }),
    })) as unknown as typeof fetch;
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.diagnostic).toMatchObject({
      finishReason: "length",
      messageFields: { content: "string(0)", reasoning_content: "string(40)" },
    });
  });

  it("passes an upstream rate limit through as a rate limit", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl: fetchImpl as typeof fetch });
    expect(res).toMatchObject({ ok: false, status: 429 });
  });

  it("does not leak an authentication failure to the caller as a rate limit", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401 }) as Response);
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl: fetchImpl as typeof fetch });
    expect(res).toMatchObject({ ok: false, status: 502 });
    if (res.ok) return;
    expect(res.error).not.toMatch(/401|key|token/i);
  });

  it("survives a transport failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl: fetchImpl as typeof fetch });
    expect(res).toMatchObject({ ok: false, status: 502 });
  });

  it("sends the key as a bearer token, and the instruction with the copy", async () => {
    const fetchImpl = fetchReturning(JSON.stringify([{ heading: "ok" }]));
    await rewriteSections(DOC, "translate to Hindi", {
      apiKey: "secret-key",
      model: "sarvam-105b-conversations",
      fetchImpl,
    });
    const [url, init] = calls(fetchImpl)[0] as [string, RequestInit];
    expect(url).toBe("https://api.sarvam.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("sarvam-105b-conversations");
    expect(sent.messages[1].content).toContain("translate to Hindi");
    expect(sent.messages[1].content).toContain("Original heading");
  });

  it("defaults to the larger model", async () => {
    const fetchImpl = fetchReturning(JSON.stringify([{ heading: "ok" }]));
    await rewriteSections(DOC, "hi", { apiKey: "k", fetchImpl });
    expect(bodyOf(fetchImpl).model).toBe("sarvam-105b");
  });
});

/**
 * How the work is divided.
 *
 * One call per document did not fit: measured against the live API a single section took
 * 13-21s and a nine-section site in Hindi ran past the route's 50s abort. These pin the
 * batching that replaced it.
 */
describe("rewriteSections batching", () => {
  it("never spends a call on a spacer", async () => {
    const fetchImpl = fetchReturning("[]");
    const spacersOnly: Section[] = [
      { id: "a", kind: "spacer", scrollHeight: 600 },
      { id: "b", kind: "spacer", scrollHeight: 700 },
    ];
    const res = await rewriteSections(spacersOnly, "warmer", { ...opts, fetchImpl });
    expect(res).toEqual({ ok: true, sections: spacersOnly });
    expect(calls(fetchImpl)).toHaveLength(0);
  });

  it("splits the sections that do carry copy into batches", async () => {
    const fetchImpl = fetchEchoing((h) => `New ${h}`);
    await rewriteSections(SITE, "warmer", { ...opts, fetchImpl });
    // 9 sections, 2 of them spacers, so 7 to rewrite.
    expect(calls(fetchImpl)).toHaveLength(Math.ceil(7 / BATCH_SIZE));
  });

  it("puts every rewritten heading back on the section it came from", async () => {
    const fetchImpl = fetchEchoing((h) => `New ${h}`);
    const res = await rewriteSections(SITE, "warmer", { ...opts, fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sections.map((s) => s.heading)).toEqual([
      "New Heading 0",
      "New Heading 1",
      "New Heading 2",
      undefined,
      "New Heading 4",
      "New Heading 5",
      "New Heading 6",
      undefined,
      "New Heading 8",
    ]);
  });

  it("keeps the spacers untouched and in place", async () => {
    const res = await rewriteSections(SITE, "warmer", {
      ...opts,
      fetchImpl: fetchEchoing((h) => `New ${h}`),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sections[3]).toEqual(SITE[3]);
    expect(res.sections[7]).toEqual(SITE[7]);
  });

  it("gives every batch the whole site as context, so the wording stays consistent", async () => {
    const fetchImpl = fetchEchoing((h) => h);
    await rewriteSections(SITE, "warmer", { ...opts, fetchImpl });
    for (let i = 0; i < calls(fetchImpl).length; i++) {
      const prompt = String(bodyOf(fetchImpl, i).messages[1].content);
      expect(prompt).toContain("Heading 0");
      expect(prompt).toContain("Heading 8");
      expect(prompt).toContain("(spacer)");
    }
  });

  // A half-rewritten site is worse than an unchanged one.
  it("applies nothing at all when one batch fails", async () => {
    // Every batch but the second answers correctly, so the failure is the upstream 500
    // and not a mis-shaped stub.
    let n = 0;
    const good = fetchEchoing((h) => `New ${h}`);
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      n += 1;
      if (n === 2) return { ok: false, status: 500 } as Response;
      return (good as unknown as (u: string, i: RequestInit) => Promise<Response>)(url, init);
    }) as unknown as typeof fetch;
    const res = await rewriteSections(SITE, "warmer", { ...opts, fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(502);
    expect(res.error).toMatch(/could not complete/i);
  });

  it("rewrites a section count no single call could hold", async () => {
    const fetchImpl = fetchEchoing((h) => `New ${h}`);
    const res = await rewriteSections(SITE, "warmer", { ...opts, fetchImpl });
    expect(res.ok).toBe(true);
    expect(calls(fetchImpl).length).toBeGreaterThan(1);
  });

  it("refuses a site longer than batching can finish in one request", async () => {
    const fetchImpl = fetchReturning("[]");
    const huge = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, kind: "text" as const, heading: "h" }));
    const res = await rewriteSections(huge, "warmer", { ...opts, fetchImpl });
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(calls(fetchImpl)).toHaveLength(0);
  });
});

describe("systemPrompt", () => {
  it("forbids inventing the claims a site owner would have to defend", () => {
    expect(systemPrompt()).toMatch(/never invent statistics/i);
  });

  it("tells the model to answer with the array and stop", () => {
    expect(systemPrompt()).toMatch(/do not explain yourself/i);
  });
});
