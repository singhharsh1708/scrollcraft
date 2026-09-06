import { describe, it, expect, vi } from "vitest";
import {
  completionsUrl,
  describeCompletion,
  extractJsonArray,
  mergeCopyOnly,
  rewriteSections,
  systemPrompt,
} from "@/lib/assistant";
import type { Section } from "@/lib/siteSchema";

function reply(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

function fetchReturning(content: string) {
  return vi.fn(async () => reply(content)) as unknown as typeof fetch;
}

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

describe("rewriteSections", () => {
  it("applies a well formed rewrite", async () => {
    const res = await rewriteSections(DOC, "make it warmer", {
      ...opts,
      fetchImpl: fetchReturning(
        JSON.stringify([{ heading: "Warmer heading", body: "Warmer body." }, {}])
      ),
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
          {},
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

  it("rejects a reply that changes the section count", async () => {
    const res = await rewriteSections(DOC, "trim it", {
      ...opts,
      fetchImpl: fetchReturning(JSON.stringify([{ heading: "Only one" }])),
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
      fetchImpl: fetchReturning('[{"heading": 42}, {}]'),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects copy that exceeds what the schema allows", async () => {
    const res = await rewriteSections(DOC, "expand", {
      ...opts,
      fetchImpl: fetchReturning(JSON.stringify([{ heading: "x".repeat(501) }, {}])),
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("reports an empty completion rather than wiping the copy", async () => {
    const res = await rewriteSections(DOC, "hi", { ...opts, fetchImpl: fetchReturning("   ") });
    expect(res).toMatchObject({ ok: false, status: 502 });
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

  it("sends the key as a bearer token and the instruction with the sections", async () => {
    const fetchImpl = fetchReturning(JSON.stringify([{ heading: "ok" }, {}]));
    await rewriteSections(DOC, "translate to Hindi", {
      apiKey: "secret-key",
      model: "sarvam-105b-conversations",
      fetchImpl,
    });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.sarvam.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("sarvam-105b-conversations");
    expect(sent.messages[1].content).toContain("translate to Hindi");
    expect(sent.messages[1].content).toContain("Original heading");
  });

  it("defaults to the larger model", async () => {
    const fetchImpl = fetchReturning(JSON.stringify([{ heading: "ok" }, {}]));
    await rewriteSections(DOC, "hi", { apiKey: "k", fetchImpl });
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).model).toBe("sarvam-105b");
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
    const secret = "Radiance, redefined.";
    const d = describeCompletion({ choices: [{ message: { content: secret } }] });
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

describe("systemPrompt", () => {
  it("forbids inventing the claims a site owner would have to defend", () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/never invent statistics/i);
    expect(prompt).toMatch(/spacer/i);
  });
});
