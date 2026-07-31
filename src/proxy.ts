// Edge-compatible proxy — no Prisma/Node modules here.
// Sessions use the database strategy (see auth.ts), so the cookie holds an opaque
// session token that can only be resolved against the Session table. That is not
// possible at the Edge, so this is an optimistic check on session-cookie presence;
// real enforcement happens in the data layer, where every API route and page calls
// auth() from @/auth.
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/create", "/editor", "/dashboard"];

// Auth.js names the session cookie `authjs.session-token`, and prefixes it with
// `__Secure-` when the cookie is issued over HTTPS (i.e. in production).
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const hasSessionCookie = SESSION_COOKIE_NAMES.some(
    (name) => !!req.cookies.get(name)?.value
  );

  if (isProtected && !hasSessionCookie) {
    const signIn = new URL("/auth/signin", req.url);
    signIn.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/create/:path*", "/editor/:path*", "/dashboard/:path*"],
};
