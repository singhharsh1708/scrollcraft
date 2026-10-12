import { NextResponse, type NextRequest } from "next/server";
import { accountIdentity } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { createCheckout, stripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * Open a checkout for the account that is signed in.
 *
 * Signing in comes first, deliberately. A pack bought by nobody in particular has to be
 * tied to a browser or to a key somebody can lose; a pack bought by an account is simply
 * there the next time they sign in, on any machine. So there is no anonymous purchase:
 * the answer to "who gets these credits" is settled before any money moves.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "The shop is not open on this deployment." }, { status: 503 });
  }

  const limit = await rateLimit(getClientIp(req), { bucket: "checkout", limit: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  }

  const identity = await accountIdentity();
  if (!identity) {
    return NextResponse.json(
      { error: "Sign in first, so the pack lands on your account and follows you to any browser.", needsSignIn: true },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json({ url: await createCheckout(identity) });
  } catch (err) {
    logger.error("could not open a checkout", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Could not open the checkout just now. Try again in a minute." }, { status: 502 });
  }
}
