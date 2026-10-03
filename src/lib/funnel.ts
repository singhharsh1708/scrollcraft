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

function send(name: FunnelEvent, properties?: Record<string, string | number>): void {
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) return;
  try {
    track(name, properties);
  } catch {
    // An ad blocker, a stale script or no network. None of that is the editor's problem.
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
