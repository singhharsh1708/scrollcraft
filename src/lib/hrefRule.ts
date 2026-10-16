// Kept apart from siteSchema so client pages can use it without loading zod.

/**
 * Where a button may point.
 *
 * Includes a bare page file, because that is what a multi page export links to and what
 * the nav itself writes: `contact.html`, optionally with an anchor. No slash, no scheme
 * and no dots, so it cannot climb out of the folder or turn into a javascript: URL.
 */
export function isAllowedHref(value: string): boolean {
  if (value.startsWith("//")) return false;
  return /^(?:#|\/|\.{1,2}\/|https?:\/\/|mailto:|tel:)/i.test(value) || /^[a-z0-9][a-z0-9-]*\.html(?:#[A-Za-z0-9_-]+)?$/.test(value);
}
