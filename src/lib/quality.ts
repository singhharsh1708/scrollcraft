/** How hard the site writer works. Every level costs one credit. */
export const QUALITIES = {
  fast: { label: "Fast", model: "claude-sonnet-5-5", effort: "medium", wait: "About 15 seconds." },
  balanced: { label: "Balanced", model: "claude-opus-5-5", effort: "medium", wait: "About half a minute." },
  best: { label: "Best", model: "claude-opus-5-5", effort: "high", wait: "A minute or two." },
} as const;

export type Quality = keyof typeof QUALITIES;

export const DEFAULT_QUALITY: Quality = "balanced";

export function parseQuality(value: unknown): Quality {
  return typeof value === "string" && Object.hasOwn(QUALITIES, value) ? (value as Quality) : DEFAULT_QUALITY;
}
