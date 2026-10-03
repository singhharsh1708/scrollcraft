import { track } from "@vercel/analytics";

/**
 * How many people who open the editor come out with a site.
 *
 * Counts only. The privacy page promises that what someone types stays on their device,
 * so nothing here takes free text: the template name is checked against the shape of a
 * slug before it is sent, and anything else is reported as "custom".
 */
export const FUNNEL_EVENTS = ["editor_opened", "first_edit", "export_started", "export_finished"] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Longest an export could plausibly take. Past this the number is a bug, not a measurement. */
const MAX_EXPORT_MS = 600_000;

/**
 * When the running export began.
 *
 * The clock lives here rather than in the editor: reading it during a component's render
 * is exactly what the purity rule forbids, and the editor has no other use for the number.
 */
let exportStartedAt: number | null = null;

/**
 * A browser being driven by a script.
 *
 * Set by every automation framework and by Chrome's own remote debugging. Our headless
 * checks opened the editor a dozen times in one afternoon and all of it counted, so the
 * first real numbers were mostly us. A visitor who finishes a site is the whole point of
 * these counts, and a robot never does.
 */
function driven(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function send(name: FunnelEvent, properties?: Record<string, string | number>): void {
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) return;
  if (driven()) return;
  try {
    track(name, properties);
  } catch {
    // An ad blocker, a stale script or no network. None of that is the editor's problem.
  }
  // Vercel keeps custom events behind its Pro plan, so the counts we actually read back
  // come from our own route. sendBeacon, because an export can be followed by the tab
  // closing and a fetch would be cancelled with it.
  try {
    const body = JSON.stringify({ event: name, ...properties });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/count", blob)) {
      void fetch("/api/count", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Same again: a count is never worth an error in someone's editor.
  }
}

/** A catalogue slug, or "custom" for anything a person named themselves. */
function safeTemplate(slug: string | null | undefined): string {
  return slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 40 ? slug : "custom";
}

export function countEditorOpened(templateSlug?: string | null): void {
  send("editor_opened", { template: safeTemplate(templateSlug) });
}

export function countFirstEdit(): void {
  send("first_edit");
}

export function countExportStarted(): void {
  exportStartedAt = Date.now();
  send("export_started");
}

export function countExportFinished(): void {
  const elapsedMs = exportStartedAt === null ? Number.NaN : Date.now() - exportStartedAt;
  exportStartedAt = null;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_EXPORT_MS) {
    send("export_finished");
    return;
  }
  send("export_finished", { seconds: Math.round(elapsedMs / 1000) });
}
