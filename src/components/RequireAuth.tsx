"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Page-level session gate. proxy.ts only checks that a session cookie is present —
 * it cannot resolve database sessions at the Edge — so a stale or revoked cookie
 * still reaches the page. This verifies the session for real and sends anyone
 * without one to sign-in, preserving where they were headed.
 *
 * Must be rendered inside a Suspense boundary (it reads search params).
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const query = searchParams.toString();
    const callbackUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [status, router, pathname, searchParams]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
