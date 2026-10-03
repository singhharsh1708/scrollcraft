import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track: trackMock }));

import { FUNNEL_EVENTS, countEditorOpened, countFirstEdit, countExportStarted, countExportFinished } from "@/lib/funnel";

/**
 * 399 people visited in 30 days and 55 reached /create, and we could not say whether a
 * single one came out with a site. Four counts answer that. They must stay counts: the
 * privacy page promises that what you type stays on your device, and that promise is
 * worth more than any metric.
 */

const beaconMock = vi.fn((_url: string, _body: unknown) => true);

beforeEach(() => {
  trackMock.mockClear();
  beaconMock.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
  vi.stubGlobal("navigator", { sendBeacon: beaconMock, webdriver: false });
  vi.stubGlobal("Blob", class { constructor(public parts: string[]) {} text() { return this.parts.join(""); } });
});

async function beaconBody(): Promise<Record<string, unknown>> {
  const blob = beaconMock.mock.calls.at(-1)?.[1] as unknown as { parts: string[] };
  return JSON.parse(blob.parts.join(""));
}

describe("the four counts that say whether this product works", () => {
  it("names exactly the four steps of the funnel", () => {
    expect(FUNNEL_EVENTS).toEqual(["editor_opened", "first_edit", "export_started", "export_finished"]);
  });

  it("records which template was opened, since that decides what we build next", () => {
    countEditorOpened("aurabeauty");
    expect(trackMock).toHaveBeenCalledWith("editor_opened", { template: "aurabeauty" });
  });

  it("records a finished export with how long it took, rounded to whole seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    countExportStarted();
    vi.setSystemTime(new Date("2026-10-03T10:00:14.820Z"));
    countExportFinished();
    expect(trackMock).toHaveBeenLastCalledWith("export_finished", { seconds: 15 });
    vi.useRealTimers();
  });

  it("sends the two events that carry nothing at all", () => {
    countFirstEdit();
    countExportStarted();
    expect(trackMock).toHaveBeenNthCalledWith(1, "first_edit", undefined);
    expect(trackMock).toHaveBeenNthCalledWith(2, "export_started", undefined);
  });

  it("still counts an export that finished, even when the start was never seen", async () => {
    // A reload mid-export, or a second tab: a fresh module that never saw the start.
    vi.resetModules();
    const fresh = await import("@/lib/funnel");
    fresh.countExportFinished();
    expect(trackMock).toHaveBeenCalledWith("export_finished", undefined);
  });
});

describe("the counts reach our own store, not only the analytics vendor", () => {
  it("posts the same four events to /api/count", async () => {
    countEditorOpened("kept");
    expect(beaconMock).toHaveBeenCalledWith("/api/count", expect.anything());
    expect(await beaconBody()).toEqual({ event: "editor_opened", template: "kept" });
  });

  it("sends nothing to our route outside production either", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "");
    countFirstEdit();
    expect(beaconMock).not.toHaveBeenCalled();
  });
});

describe("a browser being driven by a script is not a visitor", () => {
  it("counts nothing when navigator.webdriver is set", () => {
    // Our own headless checks opened the editor 12 times in one afternoon, and every one
    // of them counted. The first numbers anybody read were mostly us.
    vi.stubGlobal("navigator", { sendBeacon: beaconMock, webdriver: true });
    countEditorOpened("kept");
    countFirstEdit();
    countExportStarted();
    countExportFinished();
    expect(trackMock).not.toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it("still counts an ordinary browser", () => {
    countEditorOpened("kept");
    expect(beaconMock).toHaveBeenCalled();
  });
});

describe("it cannot carry a person's work, even by accident", () => {
  it("sends a template slug only when it looks like one", () => {
    countEditorOpened("Our Clinic's Private Draft, 2026");
    expect(trackMock).toHaveBeenCalledWith("editor_opened", { template: "custom" });
  });

  it("refuses a slug long enough to hide content in", () => {
    countEditorOpened("a".repeat(120));
    expect(trackMock).toHaveBeenCalledWith("editor_opened", { template: "custom" });
  });

  it("keeps a nonsense duration out of the numbers, without losing the count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    countExportStarted();
    trackMock.mockClear();
    // A tab left open overnight, or a clock that moved under us.
    vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
    countExportFinished();
    expect(trackMock).toHaveBeenCalledWith("export_finished", undefined);
    vi.useRealTimers();
  });

  it("stays silent outside production, so local runs never reach the dashboard", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "");
    countEditorOpened("kept");
    countFirstEdit();
    countExportStarted();
    countExportFinished();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("never throws into the editor if analytics is blocked or missing", () => {
    trackMock.mockImplementationOnce(() => { throw new Error("blocked by an extension"); });
    expect(() => countFirstEdit()).not.toThrow();
  });
});

describe("the editor counts the steps, and the privacy page says so", () => {
  const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");
  // Collapsed, because JSX wraps a sentence wherever the line runs out.
  const PRIVACY = readFileSync("src/app/privacy/page.tsx", "utf8").replace(/\s+/g, " ");

  it("calls all four from the editor", () => {
    for (const fn of ["countEditorOpened", "countFirstEdit", "countExportStarted", "countExportFinished"]) {
      expect(EDITOR, `${fn} is never called`).toContain(`${fn}(`);
    }
  });

  it("discloses the counts where it already discloses everything else", () => {
    expect(PRIVACY).toMatch(/how many people open the editor/i);
    expect(PRIVACY).toContain("Vercel Web Analytics");
    expect(PRIVACY).not.toContain("Three things can leave your browser");
  });

  it("does not hand the funnel anything a person typed", () => {
    // The editor holds headings, body copy and a site name. None of them may be arguments.
    const calls = [...EDITOR.matchAll(/count(?:EditorOpened|FirstEdit|ExportStarted|ExportFinished)\(([^)]*)\)/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    for (const arg of calls) {
      expect(arg, `a funnel call passes ${arg}`).not.toMatch(/siteName|siteDescription|heading|body|customCss|customHead|sections/i);
    }
  });
});
