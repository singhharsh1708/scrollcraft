// Edge-compatible middleware — uses the lightweight auth config (no Prisma/Node modules).
// The full auth.ts (with Prisma adapter) is only used in API routes / Server Components.
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PROTECTED_PATHS = ["/create", "/editor", "/dashboard"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected && !req.auth) {
    const signIn = new URL("/auth/signin", req.url);
    signIn.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: ["/create", "/editor", "/dashboard/:path*"],
};
