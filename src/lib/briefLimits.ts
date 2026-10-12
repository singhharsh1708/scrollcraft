/**
 * The caps on what somebody can send to have a site written.
 *
 * Their own module, with no zod import, because the page that collects the description
 * is a client component: importing these from the schema file pulled the whole zod
 * namespace into the browser bundle, which is the 41 KiB of translated validation
 * messages siteSchema.ts already goes out of its way to avoid.
 */
export const MAX_DESCRIPTION = 2000;
export const MAX_IMAGES = 3;
/** Per image, decoded. Three of these plus the rules stays well inside the request cap. */
export const MAX_IMAGE_BYTES = 1_500_000;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
