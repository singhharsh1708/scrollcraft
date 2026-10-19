import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { exportReadme } from "@/lib/exportAssets";

const README = exportReadme("Site", true, "https://example.test");
const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");
const HOME = readFileSync("src/app/HomeClient.tsx", "utf8");

describe("getting an export online is described as it really works", () => {
  it("has the owner make a Netlify account first, since an anonymous drop stays private", () => {
    const netlify = README.slice(README.indexOf("**Netlify"), README.indexOf("**Vercel**"));
    expect(netlify).toContain("1. Create a free account at https://app.netlify.com/signup");
    expect(netlify).toContain("2. While signed in, open https://app.netlify.com/drop");
    expect(netlify).toContain("Without an account, Netlify keeps the site private and deletes it unless you claim it.");
    expect(netlify).not.toMatch(/entire process/);
  });

  it("never tells the owner no account is needed", () => {
    expect(README).not.toMatch(/\bno account\b/i);
  });

  it("ends an export with where the steps are, rather than a developer command", () => {
    const done = EDITOR.slice(EDITOR.indexOf("countExportFinished();"), EDITOR.indexOf("const visibleForExport"));
    expect(done).toContain("README.md inside has the steps.");
    expect(done).toContain("{ duration: 10000 }");
    expect(done).not.toContain("npx serve");
    expect(README).toContain("## Put it online");
  });

  it("keeps each download's object URL alive after the click", () => {
    // WebKit bug 211234: revoking straight after the click could cancel the download on iOS.
    const downloads = EDITOR.match(/\ba\.click\(\);/g) ?? [];
    expect(downloads.length, "the editor no longer downloads anything").toBeGreaterThan(0);
    expect(EDITOR).not.toMatch(/a\.click\(\);\s*URL\.revokeObjectURL/);
    expect(EDITOR.match(/a\.click\(\);\s*setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\);/g)).toHaveLength(downloads.length);
  });

  it("says on the home page that the host needs an account", () => {
    const start = HOME.indexOf('id: "export"');
    expect(HOME.slice(start, HOME.indexOf("panel:", start))).toMatch(/body: "[^"]*account[^"]*"/);
  });
});
