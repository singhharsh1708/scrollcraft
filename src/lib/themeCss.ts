import type { Theme } from "@/lib/siteSchema";

export interface TypeScale {
  heading: string;
  body: string;
  measure: number;
}

export const TYPE_SCALES: Record<"compact" | "editorial" | "poster", TypeScale> = {
  compact: { heading: "clamp(1.6rem,3.4vw,2.6rem)", body: "1rem", measure: 560 },
  editorial: { heading: "clamp(2rem,5vw,4rem)", body: "1.125rem", measure: 600 },
  poster: { heading: "clamp(2.6rem,8vw,6.5rem)", body: "1.25rem", measure: 640 },
};

export interface CompiledTheme {
  vars: Record<string, string>;
  fontHref: string | null;
  scale: TypeScale;
  fontDisplay: string | null;
  fontBody: string | null;
}

export function compileTheme(theme: Theme | null | undefined): CompiledTheme {
  const t = theme ?? {};
  const scale = TYPE_SCALES[t.scale ?? "editorial"];
  const vars: Record<string, string> = {
    "--sc-heading-size": scale.heading,
    "--sc-body-size": scale.body,
    "--sc-measure": `${scale.measure}px`,
  };
  if (t.fontDisplay) vars["--sc-font-display"] = `'${t.fontDisplay}', system-ui, sans-serif`;
  if (t.fontBody) vars["--sc-font-body"] = `'${t.fontBody}', system-ui, sans-serif`;
  if (t.displayWeight) vars["--sc-display-weight"] = String(t.displayWeight);
  if (t.displayCase === "upper") vars["--sc-display-case"] = "uppercase";
  if (t.displayTracking !== undefined) vars["--sc-display-tracking"] = `${t.displayTracking}em`;
  if (t.ink) vars["--sc-ink"] = t.ink;
  if (t.muted) vars["--sc-muted"] = t.muted;
  if (t.accent) vars["--sc-accent"] = t.accent;
  if (t.accentText) vars["--sc-accent-text"] = t.accentText;
  if (t.ground) vars["--sc-ground"] = t.ground;
  if (t.radius !== undefined) vars["--sc-radius"] = `${t.radius}px`;

  const families = [t.fontDisplay, t.fontBody].filter(
    (f, i, all): f is string => Boolean(f) && all.indexOf(f) === i
  );
  const fontHref = families.length
    ? `https://fonts.googleapis.com/css2?${families
        .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;800`)
        .join("&")}&display=swap`
    : null;

  return {
    vars,
    fontHref,
    scale,
    fontDisplay: t.fontDisplay ?? null,
    fontBody: t.fontBody ?? null,
  };
}

export function varsToCss(vars: Record<string, string>): string {
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
}

/**
 * For CSS a site author wrote, rendered on OUR origin rather than in their own export.
 * Escapes closing tags so the block cannot terminate itself, and strips the constructs
 * that turn a stylesheet into a request or a script.
 */
export function sanitizeHostedCss(css: unknown): string {
  return String(css ?? "")
    .slice(0, 50_000)
    .replace(/<\/style/gi, "<\\/style")
    .replace(/<\s*script/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/url\(\s*["']?\s*(javascript|data|vbscript):[^)]*\)/gi, "url()");
}
