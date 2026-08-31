import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AUTOSAVE_DEBOUNCE_MS, saveStatusLabel } from "@/lib/saveStatus";

/**
 * A document lives in this browser and nowhere else, so the editor writes it without
 * being asked. Verified in Chrome before landing: opening /editor?template=orbitcrm,
 * typing in the site name and never touching Save leaves the document in IndexedDB
 * within the debounce window; on the previous build the database was never created.
 */

const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");

describe("save status label", () => {
  it("says nothing when there is nothing to say", () => {
    expect(saveStatusLabel(false, "idle")).toBeNull();
  });

  it("prefers a new edit over an earlier success", () => {
    // The window between a keystroke and the next write is exactly when "Saved" would
    // convince someone it is safe to close the tab.
    expect(saveStatusLabel(true, "saved")).toBe("Unsaved changes");
    expect(saveStatusLabel(false, "saved")).toBe("Saved");
  });

  it("reports a failure over anything else", () => {
    expect(saveStatusLabel(false, "failed")).toBe("Not saved");
    expect(saveStatusLabel(true, "failed")).toBe("Not saved");
  });

  it("reports a write in flight over a pending edit", () => {
    expect(saveStatusLabel(true, "saving")).toBe("Saving…");
  });

  it("does not call it saved when only the background was dropped", () => {
    // The document write can succeed while the frames write fails: the frames are
    // megabytes and are what a quota rejects. Verified in Chrome with the frames put
    // rejected as QuotaExceededError - the previous build showed "Saved" while storing
    // the document with framesKey undefined, so the background was already gone.
    expect(saveStatusLabel(false, "partial")).toBe("Background not saved");
  });

  it("keeps that warning up once a new edit lands", () => {
    // Unlike "Saved", it reports something already lost, so it must not flicker away on
    // the next keystroke.
    expect(saveStatusLabel(true, "partial")).toBe("Background not saved");
    expect(saveStatusLabel(true, "failed")).toBe("Not saved");
  });
});

describe("editor autosave", () => {
  it("debounces long enough to not write mid-word, short enough to survive a closed tab", () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBeGreaterThanOrEqual(500);
    expect(AUTOSAVE_DEBOUNCE_MS).toBeLessThanOrEqual(5000);
  });

  it("writes the document on a timer, not only from the Save button", () => {
    expect(EDITOR).toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?writeDocumentRef\.current\(/);
    expect(EDITOR).toContain("}, AUTOSAVE_DEBOUNCE_MS);");
  });

  it("does not force a frame write on the autosave path", () => {
    // Frames are megabytes. Rewriting them per keystroke would push IndexedDB into
    // eviction and stall the editor; the signature check inside writeDocument still
    // persists them the first time and whenever the background actually changes.
    expect(EDITOR).toContain("writeDocumentRef.current({ withFrames: false })");
    expect(EDITOR).toContain("await writeDocument({ withFrames: true })");
  });

  it("holds off while the editor is still restoring or has nothing real to save", () => {
    expect(EDITOR).toContain("if (!dirty || isDemo || hydrating) return;");
  });

  it("leaves edits made during a write marked unsaved", () => {
    const autosave = EDITOR.slice(EDITOR.indexOf("AUTOSAVE_DEBOUNCE_MS);") - 1200);
    expect(autosave).toMatch(/editGenRef\.current !== genAtSave/);
  });

  it("tells the user when the write kept the text but not the background", () => {
    expect(EDITOR).toContain('setSaveState(framesCached ? "saved" : "partial");');
    // Both paths must agree: the manual save already warned via a toast.
    expect([...EDITOR.matchAll(/framesCached \? "saved" : "partial"/g)]).toHaveLength(2);
  });

  it("never passes the placeholder background off as the user's own", () => {
    // A framesKey is a handoff, not the data. When the entry is gone - evicted storage,
    // another browser, an old bookmark - the editor kept the demo frames with isDemo
    // false, so they were saved and exported as a real background.
    const loader = EDITOR.slice(EDITOR.indexOf("Load desktop frames from IndexedDB"));
    const body = loader.slice(0, loader.indexOf("const audioFileRef"));
    expect(body).toContain("setIsDemo(true);");
    expect(body).toMatch(/toast\.warning\(/);
    // Preferring a redraw over a warning, where the URL still carries the recipe.
    expect(body).toContain("siteStyleSchema.safeParse({ style: styleParam, colors: colorParams })");
    expect(body).toContain("generate2DFrames(");
  });

  it("keeps the unload warning as the backstop for the debounce window", () => {
    expect(EDITOR).toContain('window.addEventListener("beforeunload", onBeforeUnload);');
    expect(EDITOR).toMatch(/if \(!dirty\) return;/);
  });
});
