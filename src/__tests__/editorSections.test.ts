import { describe, it, expect } from "vitest";
import { fillSections } from "@/lib/editorSections";
import { briefToSite } from "@/lib/siteBrief";
import type { Brief } from "@/lib/siteBrief";

/**
 * Opening a site somebody else wrote.
 *
 * Measured before this: a site written from a description opened the editor on an error
 * page. The document was valid, the sections were valid, and the properties panel read
 * `bodyColor.startsWith(...)` on a section that had no bodyColor, because only the editor
 * had ever written a document until now.
 */
const BRIEF: Brief = {
  siteName: "Leeds Film Camera Repair",
  tagline: "Vintage Nikon and Pentax repairs from a Leeds workshop",
  style: "geometric",
  colors: ["#7a4a1e", "#d9b48a", "#0c0a09"],
  fontPair: "Fraunces with Karla",
  ink: "#efe9df",
  accent: "#7a4a1e",
  accentText: "#d9b48a",
  sections: [
    { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Leeds workshop", heading: "Your old film camera, repaired by hand.", body: "", ctaLabel: "Send me your camera" },
    { kind: "text", layout: "left", reveal: "fade", eyebrow: "The bench", heading: "Mostly Nikon and Pentax.", body: "Six to eight weeks, and photographs as the work goes.", ctaLabel: "" },
    { kind: "text", layout: "right", reveal: "stagger", eyebrow: "Not for", heading: "No digital bodies. No phones.", body: "If it has a sensor in it, it is not mine to fix.", ctaLabel: "" },
  ],
};

const PANEL_FIELDS = ["id", "eyebrow", "heading", "body", "ctaLabel", "ctaHref", "accentColor", "headingColor", "bodyColor", "align", "justify"] as const;

describe("a document the editor did not write still opens", () => {
  const site = briefToSite(BRIEF);
  const filled = fillSections(site.sections, site.theme, "saved");

  it("gives every field the properties panel reads a string to read", () => {
    for (const section of filled) {
      for (const field of PANEL_FIELDS) {
        expect(typeof section[field], `${field} on ${section.id}`).toBe("string");
      }
      // The panel's own expression, which is what threw.
      expect(() => section.bodyColor.startsWith("rgba")).not.toThrow();
      expect(typeof section.scrollHeight).toBe("number");
      expect(typeof section.visible).toBe("boolean");
    }
  });

  it("is missing those fields before it is filled, which is why this is needed", () => {
    const raw = site.sections[0] as Record<string, unknown>;
    expect(raw.bodyColor).toBeUndefined();
    expect(raw.accentColor).toBeUndefined();
    expect(raw.headingColor).toBeUndefined();
  });

  it("takes the colours from the site's own theme rather than the editor's defaults", () => {
    expect(filled[0].headingColor).toBe(BRIEF.ink);
    expect(filled[0].accentColor).toBe(BRIEF.accentText);
    expect(filled[0].bodyColor).toBe(site.theme.muted);
  });

  it("keeps the ids the document was saved with, so selection and undo still match", () => {
    expect(filled.map((s) => s.id)).toEqual(site.sections.map((s) => s.id));
  });

  it("gives a section with no id one, rather than an empty string nothing can select", () => {
    const [section] = fillSections([{ heading: "Untitled" }], site.theme, "saved");
    expect(section.id).toBe("section-0-saved");
  });

  it("leaves the copy and the layout exactly as they were written", () => {
    expect(filled.map((s) => s.heading)).toEqual(BRIEF.sections.map((s) => s.heading));
    expect(filled.map((s) => s.layout)).toEqual(["center", "left", "right"]);
    expect(filled[0].body).toBe("");
  });
});
