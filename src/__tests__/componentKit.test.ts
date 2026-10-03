import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { KIT, KIT_BASE, KIT_TOKENS, kitComponent, kitPage, kitStylesheet } from "@/lib/componentKit";

/**
 * The kits people compare us to (VengeanceUI, Magic UI, Aceternity) all ship React plus a
 * motion library; the ones that serve everyone else (HyperUI, daisyUI, Preline) ship
 * markup with no behaviour. These have to paste into anything and still work, so the
 * tests are mostly about what they must NOT contain.
 */

describe("the set", () => {
  it("ships six sections, each doing a job the others do not", () => {
    expect(KIT).toHaveLength(6);
    expect(KIT.map((c) => c.id)).toEqual(["hero", "features", "pricing", "faq", "signup", "footer"]);
  });

  it("gives each one a name and a line explaining what it is for", () => {
    for (const c of KIT) {
      expect(c.name.length, c.id).toBeGreaterThan(2);
      expect(c.description.length, c.id).toBeGreaterThan(30);
      expect(c.html.trim().length, c.id).toBeGreaterThan(50);
      expect(c.css.trim().length, c.id).toBeGreaterThan(30);
    }
  });

  it("looks up a section, and misses cleanly", () => {
    expect(kitComponent("pricing")?.name).toBe("Pricing");
    expect(kitComponent("nothing")).toBeUndefined();
  });
});

describe("it needs nothing installed", () => {
  it("carries no framework, no build step and no script", () => {
    for (const c of KIT) {
      expect(c.html, `${c.id} uses React`).not.toMatch(/className|onClick=|\{\{|\bjsx\b/);
      expect(c.html, `${c.id} ships script`).not.toMatch(/<script|javascript:|on(?:load|error|click)=/i);
      const classes = [...c.html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
      for (const name of classes) {
        expect(name.startsWith("sck"), `${c.id} carries a class from somebody else's framework: ${name}`).toBe(true);
      }
    }
  });

  it("fetches nothing from anywhere, so it works offline and leaks no visitor", () => {
    for (const c of KIT) {
      expect(c.html, `${c.id} loads something remote`).not.toMatch(/<(?:img|iframe|link|source)\b|@import|url\(https?:/i);
      // The signup form posts where its owner tells it to; that is the one outbound thing.
      const links = [...c.html.matchAll(/https?:\/\/[^"' ]+/g)].map((m) => m[0]);
      for (const link of links) expect(c.id, `${c.id} links out to ${link}`).toBe("signup");
    }
  });

  it("styles itself and nothing else on the page it is pasted into", () => {
    for (const c of KIT) {
      const selectors = c.css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("}")
        .map((block) => block.split("{")[0].trim())
        .filter(Boolean)
        .flatMap((group) => group.split(","))
        .map((one) => one.trim())
        .filter((one) => one && !one.startsWith("@"));
      expect(selectors.length, `${c.id} styles nothing`).toBeGreaterThan(0);
      for (const selector of selectors) {
        // Element selectors are fine inside the block; what matters is that the block
        // is the root of every rule, so nothing outside it can be touched.
        expect(selector.startsWith(".sck"), `${c.id} restyles the host page with "${selector}"`).toBe(true);
      }
    }
  });

  it("reads the host page's colours where it has them, with its own as the fallback", () => {
    expect(KIT_TOKENS).toContain("--sck-accent");
    for (const c of KIT) {
      const colours = [...c.css.matchAll(/(?:color|background)[^;:]*:\s*([^;]+);/g)].map((m) => m[1]);
      for (const value of colours) {
        const literal = /#[0-9a-f]{3,8}|\brgb|\bhsl/i.test(value) && !value.includes("var(");
        expect(literal, `${c.id} hardcodes ${value.trim()}`).toBe(false);
      }
    }
  });
});

describe("the bar from #418", () => {
  it("carries copy that could only belong to this business", () => {
    const text = KIT.map((c) => c.html.replace(/<[^>]+>/g, " ")).join(" ").toLowerCase();
    for (const banned of ["lorem", "ipsum", "your text here", "placeholder", "coming soon", "awesome", "lands here"]) {
      expect(text, `found ${banned}`).not.toContain(banned);
    }
    // Specifics are what separate written copy from filler.
    expect(text).toContain("340 independent cafes");
    expect(text).toContain("09182736");
  });

  it("wears none of the chrome that makes a page look mass produced", () => {
    for (const c of KIT) {
      expect(c.css, `${c.id} has a tracked-out caps label`).not.toMatch(/text-transform:\s*uppercase[^}]*letter-spacing/);
      expect(c.html, `${c.id} glues an arrow to a button`).not.toMatch(/→|&rarr;|&#8594;/);
      expect(c.html, `${c.id} numbers things that are not a sequence`).not.toMatch(/>\s*0[1-9]\s*</);
    }
  });

  it("gives the keyboard somewhere visible to land", () => {
    expect(KIT_BASE).toContain(":focus-visible");
    expect(KIT_BASE).toMatch(/outline:\s*3px/);
  });

  it("labels the one input it has, and posts it over https", () => {
    const signup = kitComponent("signup")!;
    expect(signup.html).toMatch(/<label for="sck-email">/);
    expect(signup.html).toMatch(/<input id="sck-email"[^>]*type="email"[^>]*required/);
    expect(signup.html).toMatch(/action="https:\/\//);
    expect(signup.description).toMatch(/Mailchimp|Buttondown|Formspree/);
  });

  it("ships no testimonial, because a sample endorsement is a fabricated one", () => {
    expect(KIT.map((c) => c.id)).not.toContain("testimonial");
    expect(KIT.map((c) => c.html).join(" ")).not.toMatch(/“[^”]{20,}”\s*<[^>]*>\s*[A-Z][a-z]+ [A-Z]/);
  });
});

describe("what somebody pastes", () => {
  it("hands over the tokens, the shared rules and that section's own CSS", () => {
    const sheet = kitStylesheet(kitComponent("hero")!);
    expect(sheet).toContain(KIT_TOKENS);
    expect(sheet).toContain(KIT_BASE);
    expect(sheet).toContain(".sck-hero-actions");
    expect(sheet).not.toContain(".sck-plan");
  });

  it("builds a page of the whole set, with every section's CSS exactly once", () => {
    const page = kitPage();
    expect(page).toContain("<!DOCTYPE html>");
    for (const c of KIT) {
      expect(page).toContain(c.html);
      expect(page.split(c.css).length - 1, `${c.id} css appears more than once`).toBe(1);
    }
  });

  it("closes every element it opens", () => {
    const voids = new Set(["input", "br", "img", "meta", "link", "hr"]);
    for (const c of KIT) {
      const stack: string[] = [];
      for (const tag of c.html.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
        const [, closing, name, selfClosing] = tag;
        if (voids.has(name) || selfClosing) continue;
        if (closing) expect(stack.pop(), `${c.id} closes ${name} that was not open`).toBe(name);
        else stack.push(name);
      }
      expect(stack, `${c.id} leaves ${stack.join(", ")} open`).toEqual([]);
    }
  });
});

describe("everything clickable is big enough to hit", () => {
  it("keeps the disclosure triangle on the questions", () => {
    // display:flex on a summary removes the marker, and then nothing says it opens.
    expect(kitComponent("faq")!.css).toContain("display: list-item");
    expect(kitComponent("faq")!.css).not.toMatch(/summary \{[^}]*display:\s*flex/);
  });

  it("gives the smaller controls a minimum height", () => {
    // Measured in a browser first: footer links and FAQ summaries were 20px tall, under
    // the 24px that WCAG 2.5.8 asks for, and well under what a thumb wants.
    const footer = kitComponent("footer")!;
    const faq = kitComponent("faq")!;
    expect(footer.css).toMatch(/\.sck-footer-nav a \{[^}]*min-height:\s*3[2-9]px/);
    expect(faq.css).toMatch(/summary \{[^}]*padding:\s*0\.4rem/);
  });
});

describe("the page that shows the kit", () => {
  const PAGE = readFileSync("src/app/ui/page.tsx", "utf8");
  const CLIENT = readFileSync("src/app/ui/UiClient.tsx", "utf8");

  it("builds every preview from the same registry the code blocks come from", () => {
    // A preview rendered from anything else could show one thing and copy another.
    expect(PAGE).toContain("kitPage([c], \"dark\")");
    expect(PAGE).toContain("kitPage([c], \"light\")");
    expect(PAGE).toContain("components={KIT}");
    expect(CLIENT).toContain("srcDoc={light ? pageFor[c.id].light : pageFor[c.id].dark}");
  });

  it("copies the component's own html and css, not a reformatted copy of them", () => {
    expect(CLIENT).toContain("text={active === \"html\" ? c.html : c.css}");
    expect(CLIENT).toContain("navigator.clipboard.writeText(text)");
  });

  it("shows each preview in a frame of its own, so this site's CSS cannot reach into it", () => {
    expect(CLIENT).toContain("<iframe");
    expect(CLIENT).toMatch(/title=\{`\$\{c\.name\} preview`\}/);
    expect(CLIENT, "an inline preview would inherit this page's styles").not.toContain("dangerouslySetInnerHTML");
  });

  it("offers the width switcher almost nobody else has, and both grounds", () => {
    expect(CLIENT).toContain("Phone: 390");
    expect(CLIENT).toContain("Tablet: 768");
    expect(CLIENT).toContain("lightTokens");
  });

  it("is reachable: in the nav and in the sitemap", () => {
    expect(readFileSync("src/components/Navbar.tsx", "utf8")).toContain('href: "/ui"');
    expect(readFileSync("src/app/sitemap.ts", "utf8")).toContain("${siteUrl}/ui");
  });
});
