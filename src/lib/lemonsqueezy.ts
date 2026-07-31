import "server-only";
import crypto from "crypto";
import { env } from "@/lib/env";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

function headers() {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
  };
}

export interface LSCheckoutResult {
  checkoutUrl: string;
  checkoutId: string;
}

export async function createExportCheckout(params: {
  siteId: string;
  userId: string;
  userEmail: string;
  siteName: string;
}): Promise<LSCheckoutResult> {
  const { siteId, userId, userEmail, siteName } = params;

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: userEmail,
          custom: { site_id: siteId, user_id: userId },
        },
        product_options: {
          name: `ScrollCraft Export — ${siteName}`,
          description: "Download your scroll site as a pure HTML/CSS/JS ZIP",
          redirect_url: `${process.env.NEXTAUTH_URL ?? "https://scrollcraft.app"}/editor?siteId=${siteId}&purchased=1`,
        },
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: env.LEMONSQUEEZY_STORE_ID } },
        variant: { data: { type: "variants", id: env.LEMONSQUEEZY_VARIANT_ID } },
      },
    },
  };

  const res = await fetch(`${LS_API_BASE}/checkouts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return {
    checkoutUrl: json.data.attributes.url as string,
    checkoutId: json.data.id as string,
  };
}

/**
 * Look up an existing checkout so a user who already has one in flight is sent
 * back to the same payment page instead of being charged twice.
 * Returns null when the checkout can no longer be resolved.
 */
export async function getExportCheckoutUrl(checkoutId: string): Promise<string | null> {
  const res = await fetch(`${LS_API_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = await res.json();
  const url = json?.data?.attributes?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

const LS_SIGNATURE_HEX = /^[0-9a-f]{64}$/i;

export function verifyLSWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!env.LEMONSQUEEZY_WEBHOOK_SECRET || !signature) return false;
  // HMAC-SHA256 hex digest — reject anything that isn't the exact expected shape
  // before it reaches Buffer.from, which silently truncates invalid hex.
  if (!LS_SIGNATURE_HEX.test(signature)) return false;
  const expected = crypto
    .createHmac("sha256", env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    // timingSafeEqual throws if lengths differ — guard first
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
