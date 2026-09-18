import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Someone who wants more than a template has a way to ask.
 *
 * The contact page existed, but nothing on the site sent anyone to it for custom work:
 * the landing page, the template gallery and the preset gallery all ended at "build it
 * yourself".
 */
const CONTACT = readFileSync("src/app/contact/page.tsx", "utf8");
const ENTRY_POINTS = ["src/app/HomeClient.tsx", "src/app/templates/TemplatesClient.tsx", "src/app/presets/page.tsx"];

function topics(): string[] {
  const m = /const TOPICS = (\[[^\]]*\]);/.exec(CONTACT);
  expect(m, "the contact topics are gone").toBeTruthy();
  return JSON.parse(m![1]);
}

describe("a custom build has a way in", () => {
  it.each(ENTRY_POINTS)("%s links to the custom build topic", (file) => {
    expect(readFileSync(file, "utf8")).toContain('href="/contact?topic=custom"');
  });

  it("offers the topic those links ask for", () => {
    expect(topics()).toContain("Custom build");
  });

  it("resolves ?topic=custom to exactly that topic", () => {
    // The page matches the query against the start of each topic, so a second topic
    // beginning with "custom" would make the link land on whichever came first.
    expect(CONTACT).toContain("t.toLowerCase().startsWith(wanted)");
    expect(topics().filter((t) => t.toLowerCase().startsWith("custom"))).toEqual(["Custom build"]);
  });

  it("asks for what a brief needs once that topic is chosen", () => {
    expect(CONTACT).toMatch(/form\.topic === "Custom build" \? "What is the site for/);
  });
});
