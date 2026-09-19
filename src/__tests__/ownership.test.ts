import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The landing page's comparison with other site builders.
 *
 * It names other companies' products, so every row has to be something a reader can check:
 * a source on that company's own domain, and the date it was read.
 */
const HOME = readFileSync("src/app/HomeClient.tsx", "utf8");
const ROWS = [...HOME.matchAll(/\{ tool: "([^"]+)", answer: "([^"]+)", cost: "([^"]+)"(?:, source: "([^"]+)")? \}/g)].map(
  (m) => ({ tool: m[1], answer: m[2], cost: m[3], source: m[4] })
);

describe("the ownership comparison can be checked", () => {
  it("covers the builders people compare against", () => {
    expect(ROWS.map((r) => r.tool)).toEqual(["ScrollCraft", "Webflow", "Carrd", "Squarespace", "Framer", "Wix"]);
  });

  it("cites each company's own page for every claim about it", () => {
    for (const r of ROWS.filter((r) => r.tool !== "ScrollCraft")) {
      expect(r.source, `${r.tool} has no source`).toBeTruthy();
      const host = new URL(r.source!).hostname;
      expect(host, `${r.tool}'s source is not on its own domain`).toContain(r.tool.toLowerCase());
    }
  });

  it("says when the claims were read, and links every source on the page", () => {
    const date = /export const OWNERSHIP_CHECKED = "([^"]+)";/.exec(HOME)?.[1];
    expect(date).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    expect(HOME).toContain("Checked on {OWNERSHIP_CHECKED} against each company&apos;s own pages");
    expect(HOME).toContain("href={r.source}");
  });
});
