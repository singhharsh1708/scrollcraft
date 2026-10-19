import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const editor = readFileSync("src/app/editor/page.tsx", "utf8");

describe("the editor's first minute on a phone", () => {
  it("puts the preview first and starts it on the first section", () => {
    expect(editor).toContain('className="h-[36vh] max-md:order-first');
    expect(editor).toContain('window.matchMedia("(max-width: 767px)").matches) el.scrollTop = previewViewportH;');
  });

  it("shows the Heading field first in the content tab on a phone", () => {
    const content = editor.slice(editor.indexOf('<TabsContent value="content"'), editor.indexOf('<TabsContent value="style"'));
    expect(content).toContain('<div className="space-y-1.5 max-md:order-first">\n                  <label htmlFor="field-heading"');
  });

  it("hides the viewport toggles and frame counter on a phone", () => {
    expect(editor).toContain('<div className="hidden md:flex items-center bg-white/5 rounded-md p-0.5 gap-0.5">\n            {([["desktop"');
    expect(editor).toContain('<div className="hidden md:block text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">');
  });

  it("moves the secondary toolbar buttons into a More menu on a phone", () => {
    const menu = editor.slice(editor.indexOf("<Menu.Root>"), editor.indexOf("</Menu.Root>"));
    expect(menu).toContain('aria-label="More"');
    expect(menu).toContain('className="md:hidden flex h-11 w-11');
    for (const item of ["Undo", "Redo", "Save in this browser", "Open a copy from your computer", "Download a copy"]) {
      expect(menu).toContain(item);
    }
  });

  it("keeps row actions reachable on touch screens", () => {
    expect(editor).toContain("[@media(hover:none)]:opacity-100");
    expect(editor).toContain("aria-label={`Actions for ");
    expect(editor).toMatch(/\{rowMenuId === s\.id && \(\s*<div className="md:hidden grid grid-cols-4/);
  });

  it("uses 16px text in inputs on a phone so iOS does not zoom", () => {
    expect(editor).not.toMatch(/<Input[^>]*className="h-7 [^"]*text-xs/);
    expect(editor).not.toMatch(/className="h-7 bg-white\/5 border-white\/10 text-xs"/);
  });

  it("names every icon-only toolbar control", () => {
    expect(editor).toContain('aria-label="Undo"');
    expect(editor).toContain('aria-label="Redo"');
    expect(editor).toContain("aria-label={`Preview on ${mode}`}");
    expect(editor).toContain('aria-label={audioMuted ? "Unmute audio" : "Mute audio"}');
  });

  it("uses plain labels for the button fields", () => {
    expect(editor).toContain(">Small label above the heading</label>");
    expect(editor).toContain(">Button goes to</label>");
    expect(editor).not.toContain("Eyebrow text");
    expect(editor).not.toContain("CTA link");
  });
});
