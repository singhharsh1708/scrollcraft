import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/demo-frame/route";

function get(query: string): NextRequest {
  return new Request(`https://scrollcraft.app/api/demo-frame${query}`) as unknown as NextRequest;
}

async function svg(query: string): Promise<string> {
  const res = await GET(get(query));
  expect(res.status).toBe(200);
  return res.text();
}

// `total` defaults to 120 and drives `p = i / (total - 1)`, which sets every colour and
// coordinate in the document. When an absent or empty `total` wrongly resolves to 0 it is
// then clamped up to the minimum of 1, and `p` collapses to 1 for any non-zero `i` — so
// the whole animation pins to its last frame. Comparing an absent param against an empty
// one cannot catch that (both collapse the same way); each must be compared against the
// explicit value the fallback is documented to mean.
const EXPLICIT_DEFAULT = "?i=60&total=120";

describe("GET /api/demo-frame parameter handling", () => {
  it("never emits NaN into the document", async () => {
    for (const q of ["", "?i=abc&total=xyz", "?i=&total=", "?i=1e999", "?total=0"]) {
      expect(await svg(q)).not.toContain("NaN");
    }
  });

  it("applies the documented total fallback when the param is absent", async () => {
    expect(await svg("?i=60")).toBe(await svg(EXPLICIT_DEFAULT));
  });

  it("applies the documented total fallback when the param is empty", async () => {
    expect(await svg("?i=60&total=")).toBe(await svg(EXPLICIT_DEFAULT));
  });

  it("applies the documented total fallback when the param is whitespace", async () => {
    expect(await svg("?i=60&total=%20")).toBe(await svg(EXPLICIT_DEFAULT));
  });

  it("applies the documented total fallback on non-numeric input", async () => {
    expect(await svg("?i=60&total=abc")).toBe(await svg(EXPLICIT_DEFAULT));
  });

  it("renders a different frame for a different index", async () => {
    expect(await svg("?i=60&total=120")).not.toBe(await svg("?i=0&total=120"));
  });

  it("clamps out-of-range values instead of rejecting them", async () => {
    expect(await svg("?i=-5&total=120")).toBe(await svg("?i=0&total=120"));
    expect(await svg("?total=99999&i=0")).toBe(await svg("?total=1000&i=0"));
  });

  it("caps the frame index at the total", async () => {
    expect(await svg("?i=500&total=10")).toBe(await svg("?i=10&total=10"));
  });
});
