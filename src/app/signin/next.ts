/** Only a path on this site; anything else, including a scheme-relative address, becomes "/". */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(next) ? next : "/";
}

/** The /signin address that returns to `next` afterwards. */
export function signInHref(next: string): string {
  const back = safeNext(next);
  return back === "/" || back.startsWith("/signin") ? "/signin" : `/signin?next=${encodeURIComponent(back)}`;
}
