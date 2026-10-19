import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { contactLink, readPhone, withContactLink, type ContactVia } from "@/lib/contactLink";
import { isAllowedHref as ruleOnItsOwn } from "@/lib/hrefRule";
import { isAllowedHref, sectionsSchema } from "@/lib/siteSchema";
import { FONT_PAIR_NAMES, briefToSite, type Brief } from "@/lib/siteBrief";

/** What the owner types on /describe becomes the link behind a written site's buttons. */

const VIAS: ContactVia[] = ["call", "whatsapp"];

describe("what the owner types becomes a link", () => {
  it("mails an email address", () => {
    expect(contactLink("orders@annapurnatiffins.in", "call")).toBe("mailto:orders@annapurnatiffins.in");
    expect(contactLink("  mailto:Orders@Example.co.in ", "whatsapp")).toBe("mailto:Orders@Example.co.in");
  });

  it("opens a web address, and gives a bare domain https", () => {
    expect(contactLink("instagram.com/annapurna.tiffins", "call")).toBe("https://instagram.com/annapurna.tiffins");
    expect(contactLink("www.example.com", "whatsapp")).toBe("https://www.example.com");
    expect(contactLink("https://example.com/book?day=thu", "call")).toBe("https://example.com/book?day=thu");
    expect(contactLink("http://example.com", "call")).toBe("http://example.com");
  });

  it("calls or opens WhatsApp for a number that carries its country code", () => {
    for (const typed of ["+91 98765 43210", "+91-98765-43210", "0091 98765 43210", "919876543210"]) {
      expect(readPhone(typed), typed).toEqual({ digits: "919876543210", international: true });
      expect(contactLink(typed, "call"), typed).toBe("tel:+919876543210");
      expect(contactLink(typed, "whatsapp"), typed).toBe("https://wa.me/919876543210");
    }
  });

  it("reads a number pasted with invisible direction marks and typographic dashes", () => {
    expect(contactLink("\u202a+91 98765\u201343210\u202c", "whatsapp")).toBe("https://wa.me/919876543210");
    expect(contactLink("\u202aorders@example.in\u202c", "call")).toBe("mailto:orders@example.in");
  });

  it("reads a country code written in brackets, and a typed tel: link", () => {
    for (const typed of ["(+91) 98765 43210", "(0091) 98765 43210", "tel:+919876543210"]) {
      expect(contactLink(typed, "call"), typed).toBe("tel:+919876543210");
      expect(contactLink(typed, "whatsapp"), typed).toBe("https://wa.me/919876543210");
    }
    expect(contactLink("(+44) 7700 900123", "whatsapp")).toBe("https://wa.me/447700900123");
  });

  it("does not take an eleven-digit national number for an international one", () => {
    const national = [["1800 266 1234", "18002661234"], ["(21) 98765-4321", "21987654321"], ["138 0013 8000", "13800138000"]];
    for (const [typed, digits] of national) {
      expect(readPhone(typed), typed).toEqual({ digits, international: false });
      expect(contactLink(typed, "call"), typed).toBe(`tel:${digits}`);
      expect(contactLink(typed, "whatsapp"), typed).toBeNull();
    }
  });

  it("drops the (0) written after a country code", () => {
    expect(contactLink("+44 (0)20 7946 0018", "whatsapp")).toBe("https://wa.me/442079460018");
  });

  it("only calls a number with no country code, rather than guessing one for WhatsApp", () => {
    for (const [typed, digits] of [["98765 43210", "9876543210"], ["098765 43210", "09876543210"], ["(020) 7946 0018", "02079460018"]]) {
      expect(readPhone(typed), typed).toEqual({ digits, international: false });
      expect(contactLink(typed, "call"), typed).toBe(`tel:${digits}`);
      expect(contactLink(typed, "whatsapp"), typed).toBeNull();
    }
  });

  it("refuses anything a button could not use", () => {
    const junk = [
      "", "   ", "javascript:alert(1)", "//evil.example/x", "data:text/html,hi", "@annapurna_tiffins",
      "Annapurna Tiffins", "12345", "1234567890123456", "+0 123 4567", "a@b", "https://localhost", "https://exa mple.com",
    ];
    for (const typed of junk) {
      for (const via of VIAS) expect(contactLink(typed, via), `${typed} / ${via}`).toBeNull();
    }
  });

  it("only hands back links the exporter's rule accepts, and that rule is still one rule", () => {
    expect(isAllowedHref).toBe(ruleOnItsOwn);
    const typed = ["a@b.co", "example.com", "http://example.com", "+91 98765 43210", "98765 43210"];
    const links = typed.flatMap((t) => VIAS.map((via) => contactLink(t, via))).filter((l): l is string => l !== null);
    expect(links.length).toBeGreaterThan(5);
    for (const href of links) expect(isAllowedHref(href), href).toBe(true);
  });
});

describe("a written site's buttons take the link", () => {
  const BRIEF: Brief = {
    siteName: "Annapurna Tiffins",
    tagline: "Maharashtrian lunch tiffins from Kothrud since 2016",
    style: "wave",
    colors: ["#b45309", "#fde68a", "#0c0a09"],
    fontPair: FONT_PAIR_NAMES[1],
    ink: "#fafaf9",
    accent: "#9a3412",
    accentText: "#fdba74",
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Kothrud, Pune", heading: "Lunch from a home kitchen, at your desk by one", body: "", ctaLabel: "Start a plan" },
      { kind: "text", layout: "left", reveal: "fade", eyebrow: "The tiffin", heading: "Two sabzis, dal, rice and chapatis", body: "Cooked the same morning.", ctaLabel: "" },
      { kind: "text", layout: "right", reveal: "stagger", eyebrow: "Thursdays", heading: "No onion or garlic on Thursdays", body: "Every week, without exception.", ctaLabel: "" },
      { kind: "text", layout: "left", reveal: "fade", eyebrow: "Plans", heading: "Monthly plans only", body: "No single meals.", ctaLabel: "" },
      { kind: "text", layout: "center", reveal: "mask", eyebrow: "Order", heading: "Tell us where your office is", body: "We deliver in Kothrud and Karve Nagar.", ctaLabel: "Message us" },
    ],
  };
  const site = briefToSite(BRIEF);

  it("points every button the generator wrote at the owner's link", () => {
    const href = contactLink("+91 98765 43210", "whatsapp");
    const sections = withContactLink(site.sections, href);
    expect(sections.filter((s) => s.ctaLabel).length).toBe(2);
    for (const s of sections) expect(s.ctaHref).toBe(s.ctaLabel ? "https://wa.me/919876543210" : undefined);
    expect(sectionsSchema.safeParse(sections).success).toBe(true);
  });

  it("changes nothing when there is no link", () => {
    expect(withContactLink(site.sections, null)).toBe(site.sections);
  });

  it("leaves a button that already goes somewhere alone", () => {
    expect(withContactLink([{ ctaHref: "contact.html" }, { ctaHref: "#contact" }, {}], "tel:+919876543210")).toEqual([
      { ctaHref: "contact.html" },
      { ctaHref: "tel:+919876543210" },
      {},
    ]);
  });
});

describe("the contact stays in the browser", () => {
  it("is not part of what is sent to be written", () => {
    // The privacy page lists the description and photographs as all that goes.
    const source = readFileSync("src/lib/writeSite.ts", "utf8");
    const start = source.indexOf('fetch("/api/generate-site"');
    const request = source.slice(start, source.indexOf("});", start));
    expect(request).toContain("description");
    expect(request).not.toMatch(/\b(?:contact|link|via)\b/);
  });

  it("keeps zod out of the describe page", () => {
    for (const file of ["src/app/describe/DescribeClient.tsx", "src/lib/writeSite.ts", "src/lib/contactLink.ts", "src/lib/hrefRule.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/^import \{[^}]*\} from "@\/lib\/siteSchema"/m);
      expect(source, file).not.toContain('from "zod"');
    }
  });
});
