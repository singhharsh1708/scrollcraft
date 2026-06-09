import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("export-site template", () => {
  it("pins section overlay content using a sticky wrapper", () => {
    const filePath = resolve(process.cwd(), "src/app/api/export-site/route.ts");
    const src = readFileSync(filePath, "utf8");

    expect(src).toContain('class="section-content-wrapper"');
    expect(src).toMatch(/\.section-content-wrapper\s*\{\s*position:\s*sticky;/);
    expect(src).toMatch(/\.section-content-wrapper\s*\{\s*[^}]*top:\s*0;/);
    expect(src).toMatch(/\.section-content-wrapper\s*\{\s*[^}]*height:\s*100vh;/);
    expect(src).toMatch(/\.scroll-section\s*\{\s*position:\s*relative;/);
  });
});

