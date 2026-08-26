import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { TEMPLATES } from "@/lib/templates";

// The Lemon Squeezy webhook is the only thing standing between a $1 order in some
// unrelated store and a free export of any site. Every guard below is load-bearing.

const dbMock = vi.hoisted(() => ({
  revokedLsOrder: { upsert: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  templatePurchase: {
    findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
    updateMany: vi.fn(), deleteMany: vi.fn(),
  },
  exportPurchase: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  site: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

const WEBHOOK_SECRET = "ls_whsec_test";
const STORE_ID = "12345";
const VARIANT_ID = "98765";
const PRICE_CENTS = 1900;
const TEMPLATE_VARIANT_ID = "55555";
const TEMPLATE_PRICE_CENTS = 2900;

type Handler = typeof import("../app/api/webhooks/lemonsqueezy/route").POST;
let POST: Handler;

async function loadRoute(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.LEMONSQUEEZY_STORE_ID = STORE_ID;
  process.env.LEMONSQUEEZY_VARIANT_ID = VARIANT_ID;
  process.env.LEMONSQUEEZY_EXPORT_PRICE_CENTS = String(PRICE_CENTS);
  process.env.LEMONSQUEEZY_TEMPLATE_VARIANT_ID = TEMPLATE_VARIANT_ID;
  process.env.LEMONSQUEEZY_TEMPLATE_PRICE_CENTS = String(TEMPLATE_PRICE_CENTS);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  ({ POST } = await import("../app/api/webhooks/lemonsqueezy/route"));
}

function signedRequest(payload: unknown, secret: string = WEBHOOK_SECRET): NextRequest {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return new Request("https://scrollcraft.app/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: { "x-signature": signature, "content-type": "application/json" },
    body: rawBody,
  }) as unknown as NextRequest;
}

type Attrs = Record<string, unknown>;

function orderCreated(attrs: Attrs = {}, custom: Record<string, unknown> | null = { site_id: "site_1", user_id: "user_1" }) {
  return {
    meta: {
      event_name: "order_created",
      ...(custom ? { custom_data: custom } : {}),
    },
    data: {
      id: "ls_order_1",
      attributes: {
        status: "paid",
        total: PRICE_CENTS,
        currency: "USD",
        refunded: false,
        store_id: Number(STORE_ID),
        first_order_item: { variant_id: Number(VARIANT_ID) },
        ...attrs,
      },
    },
  };
}

/** No grant happened: neither a status flip to PAID nor a fresh purchase row. */
function expectNoGrant() {
  expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  expect(dbMock.exportPurchase.updateMany).not.toHaveBeenCalled();
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  dbMock.exportPurchase.updateMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.exportPurchase.findUnique.mockReset().mockResolvedValue(null);
  dbMock.exportPurchase.create.mockReset().mockResolvedValue({ id: "ep_1" });
  dbMock.exportPurchase.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.revokedLsOrder.upsert.mockReset().mockResolvedValue({ lsOrderId: "ls_order_1" });
  dbMock.revokedLsOrder.findUnique.mockReset().mockResolvedValue(null);
  dbMock.user.findUnique.mockReset().mockResolvedValue({ id: "user_1" });
  dbMock.templatePurchase.findFirst.mockReset().mockResolvedValue(null);
  dbMock.templatePurchase.findUnique.mockReset().mockResolvedValue(null);
  dbMock.templatePurchase.create.mockReset().mockResolvedValue({ id: "tp_1" });
  dbMock.templatePurchase.updateMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.templatePurchase.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.site.findFirst.mockReset().mockResolvedValue({ id: "site_1" });
  await loadRoute();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  delete process.env.LEMONSQUEEZY_STORE_ID;
  delete process.env.LEMONSQUEEZY_VARIANT_ID;
  delete process.env.LEMONSQUEEZY_EXPORT_PRICE_CENTS;
});

describe("LS webhook — authentication", () => {
  it("rejects a request whose signature was made with a different secret", async () => {
    const res = await POST(signedRequest(orderCreated(), "attacker_secret"));

    expect(res.status).toBe(401);
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
    expectNoGrant();
  });

  it("rejects a request with no signature header at all", async () => {
    const rawBody = JSON.stringify(orderCreated());
    const req = new Request("https://scrollcraft.app/api/webhooks/lemonsqueezy", {
      method: "POST",
      body: rawBody,
    }) as unknown as NextRequest;

    expect((await POST(req)).status).toBe(401);
    expectNoGrant();
  });

  it("rejects a body that was modified after signing", async () => {
    const payload = orderCreated();
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    const tamperedBody = JSON.stringify({
      ...payload,
      meta: { ...payload.meta, custom_data: { site_id: "site_1", user_id: "attacker" } },
    });
    const req = new Request("https://scrollcraft.app/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: { "x-signature": signature },
      body: tamperedBody,
    }) as unknown as NextRequest;

    expect((await POST(req)).status).toBe(401);
    expectNoGrant();
  });
});

describe("LS webhook — order validation refuses to grant", () => {
  it("refuses a custom_data whose site_id is a Prisma filter object, not a string", async () => {
    // Prisma's generated `where` types accept a filter object, so an unvalidated
    // `{ not: "" }` would widen the lookup to any row instead of identifying one.
    await POST(signedRequest(orderCreated({}, { site_id: { not: "" }, user_id: "user_1" })));

    expectNoGrant();
  });

  it("refuses a custom_data whose user_id is a filter object", async () => {
    await POST(signedRequest(orderCreated({}, { site_id: "site_1", user_id: { not: "" } })));

    expectNoGrant();
  });

  it("refuses a custom_data that is an array rather than an object", async () => {
    await POST(signedRequest(orderCreated({}, ["site_1", "user_1"] as unknown as Record<string, unknown>)));

    expectNoGrant();
  });

  it("refuses a non-string scalar site_id", async () => {
    await POST(signedRequest(orderCreated({}, { site_id: 12345, user_id: "user_1" })));

    expectNoGrant();
  });

  it("refuses when the order came from a different store", async () => {
    const res = await POST(signedRequest(orderCreated({ store_id: 999999 })));

    expect(res.status).toBe(200);
    expectNoGrant();
  });

  it("refuses when the purchased variant is not the export variant", async () => {
    const res = await POST(
      signedRequest(orderCreated({ first_order_item: { variant_id: 111111 } }))
    );

    expect(res.status).toBe(200);
    expectNoGrant();
  });

  it("refuses when the order total is below the export price", async () => {
    await POST(signedRequest(orderCreated({ total: 100 })));

    expectNoGrant();
  });

  it("refuses when the order total is above the export price", async () => {
    await POST(signedRequest(orderCreated({ total: PRICE_CENTS + 1 })));

    expectNoGrant();
  });

  it("refuses a zero-total order", async () => {
    await POST(signedRequest(orderCreated({ total: 0 })));

    expectNoGrant();
  });

  it("refuses a negative total", async () => {
    await POST(signedRequest(orderCreated({ total: -PRICE_CENTS })));

    expectNoGrant();
  });

  it("refuses a total that is not a number at all", async () => {
    await POST(signedRequest(orderCreated({ total: "free" })));

    expectNoGrant();
  });

  it("refuses a fractional total", async () => {
    await POST(signedRequest(orderCreated({ total: PRICE_CENTS - 0.5 })));

    expectNoGrant();
  });

  it("refuses a missing total", async () => {
    const payload = orderCreated();
    delete (payload.data.attributes as Attrs).total;

    await POST(signedRequest(payload));

    expectNoGrant();
  });

  it("refuses when the claimed site does not belong to the claimed user", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);

    await POST(signedRequest(orderCreated()));

    // custom_data is attacker-controlled at checkout time, so ownership is re-checked.
    expect(dbMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site_1", userId: "user_1" } })
    );
    expectNoGrant();
  });

  it("refuses when the order is not paid", async () => {
    await POST(signedRequest(orderCreated({ status: "pending" })));

    expectNoGrant();
  });

  it("refuses an order already flagged refunded", async () => {
    await POST(signedRequest(orderCreated({ refunded: true })));

    expectNoGrant();
  });

  it("refuses when custom_data is missing entirely", async () => {
    await POST(signedRequest(orderCreated({}, null)));

    expectNoGrant();
  });

  it("refuses when custom_data names a site but no user", async () => {
    await POST(signedRequest(orderCreated({}, { site_id: "site_1" })));

    expectNoGrant();
  });

  it("fails closed with a 503 when store/variant are not configured", async () => {
    await loadRoute({ LEMONSQUEEZY_STORE_ID: undefined, LEMONSQUEEZY_VARIANT_ID: undefined });

    const res = await POST(signedRequest(orderCreated()));

    expect(res.status).toBe(503);
    expectNoGrant();
  });

  it("still requires a positive total when no exact price is pinned", async () => {
    await loadRoute({ LEMONSQUEEZY_EXPORT_PRICE_CENTS: undefined });

    await POST(signedRequest(orderCreated({ total: 0 })));
    expectNoGrant();

    // ...but any positive charge for the right variant is accepted.
    await POST(signedRequest(orderCreated({ total: 500 })));
    expect(dbMock.exportPurchase.create).toHaveBeenCalledTimes(1);
  });
});

describe("LS webhook — a valid order grants", () => {
  it("creates a PAID purchase for the right store, variant, amount and owner", async () => {
    const res = await POST(signedRequest(orderCreated()));

    expect(res.status).toBe(200);
    expect(dbMock.exportPurchase.create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        siteId: "site_1",
        lsOrderId: "ls_order_1",
        amount: PRICE_CENTS,
        currency: "USD",
        status: "PAID",
      },
    });
  });

  it("accepts custom_data delivered on the order attributes instead of meta", async () => {
    await POST(
      signedRequest(
        orderCreated({ custom_data: { site_id: "site_1", user_id: "user_1" } }, null)
      )
    );

    expect(dbMock.exportPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) })
    );
  });

  it("clears stale PENDING checkout placeholders for the same site", async () => {
    await POST(signedRequest(orderCreated()));

    expect(dbMock.exportPurchase.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", siteId: "site_1", status: "PENDING", lsOrderId: { not: "ls_order_1" } },
    });
  });
});

describe("LS webhook — idempotency and revocation", () => {
  it("does not create a second purchase when the same order is redelivered", async () => {
    // An existing non-refunded row is updated in place, so the create branch is skipped.
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(signedRequest(orderCreated()));

    expect(res.status).toBe(200);
    expect(dbMock.exportPurchase.updateMany).toHaveBeenCalledWith({
      where: { lsOrderId: "ls_order_1", status: { not: "REFUNDED" } },
      data: { status: "PAID", amount: PRICE_CENTS, currency: "USD" },
    });
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("does not resurrect a refunded purchase when order_created is redelivered", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 0 });
    dbMock.exportPurchase.findUnique.mockResolvedValue({ status: "REFUNDED" });

    const res = await POST(signedRequest(orderCreated()));

    expect(res.status).toBe(200);
    // The guarded updateMany matched nothing and the row exists — creating a new
    // PAID row here would hand back access a refund already took away.
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("revokes access on order_refunded", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 1 });
    const payload = orderCreated();
    payload.meta.event_name = "order_refunded";

    const res = await POST(signedRequest(payload));

    expect(res.status).toBe(200);
    expect(dbMock.exportPurchase.updateMany).toHaveBeenCalledWith({
      where: { lsOrderId: "ls_order_1", status: { not: "REFUNDED" } },
      data: { status: "REFUNDED" },
    });
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("revokes access on a chargeback", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 1 });
    const payload = orderCreated();
    payload.meta.event_name = "order_chargeback";

    await POST(signedRequest(payload));

    expect(dbMock.exportPurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });

  it("ignores unrelated event types without touching the database", async () => {
    const payload = orderCreated();
    payload.meta.event_name = "subscription_created";

    const res = await POST(signedRequest(payload));

    expect(res.status).toBe(200);
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
    expectNoGrant();
  });
});

describe("LS webhook — a refund delivered before its order_created", () => {
  function refund(event = "order_refunded") {
    return {
      meta: { event_name: event },
      data: { id: "ls_order_1", attributes: { status: "refunded", refunded: true } },
    };
  }

  it("records a tombstone even when no purchase row exists yet", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(signedRequest(refund()));

    expect(res.status).toBe(200);
    expect(dbMock.revokedLsOrder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lsOrderId: "ls_order_1" } })
    );
  });

  it("refuses the later order_created instead of granting a refunded order", async () => {
    // Refund landed first, so only the tombstone is on record.
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 0 });
    dbMock.exportPurchase.findUnique.mockResolvedValue(null);
    dbMock.revokedLsOrder.findUnique.mockResolvedValue({
      lsOrderId: "ls_order_1", eventName: "order_refunded",
    });

    const res = await POST(signedRequest(orderCreated()));

    expect(res.status).toBe(200);
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("still grants a normal order when no tombstone exists", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 0 });
    dbMock.exportPurchase.findUnique.mockResolvedValue(null);
    dbMock.revokedLsOrder.findUnique.mockResolvedValue(null);

    await POST(signedRequest(orderCreated()));

    expect(dbMock.exportPurchase.create).toHaveBeenCalledTimes(1);
  });

  it("tombstones a chargeback the same way", async () => {
    dbMock.exportPurchase.updateMany.mockResolvedValue({ count: 0 });

    await POST(signedRequest(refund("order_chargeback")));

    expect(dbMock.revokedLsOrder.upsert).toHaveBeenCalled();
  });
});

describe("LS webhook — premium template purchases", () => {
  const PREMIUM = TEMPLATES.find((t) => t.premium)!.slug;
  const FREE = TEMPLATES.find((t) => !t.premium)!.slug;

  function templateOrder(custom: Record<string, unknown> = { template_slug: PREMIUM, user_id: "user_1" }, attrs: Attrs = {}) {
    return {
      meta: { event_name: "order_created", custom_data: custom },
      data: {
        id: "ls_order_1",
        attributes: {
          status: "paid",
          total: TEMPLATE_PRICE_CENTS,
          currency: "USD",
          refunded: false,
          store_id: Number(STORE_ID),
          first_order_item: { variant_id: Number(TEMPLATE_VARIANT_ID) },
          ...attrs,
        },
      },
    };
  }

  it("grants the template when the order is for the template variant", async () => {
    const res = await POST(signedRequest(templateOrder()));

    expect(res.status).toBe(200);
    expect(dbMock.templatePurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1", templateSlug: PREMIUM, status: "PAID",
        }),
      })
    );
    // An export must never be granted by a template order.
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("refuses a template order whose slug is not a premium template", async () => {
    await POST(signedRequest(templateOrder({ template_slug: FREE, user_id: "user_1" })));
    expect(dbMock.templatePurchase.create).not.toHaveBeenCalled();
  });

  it("refuses a template order naming an unknown user", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    await POST(signedRequest(templateOrder()));
    expect(dbMock.templatePurchase.create).not.toHaveBeenCalled();
  });

  it("refuses a template order whose total is not the template price", async () => {
    await POST(signedRequest(templateOrder(undefined, { total: 100 })));
    expect(dbMock.templatePurchase.create).not.toHaveBeenCalled();
  });

  it("will not unlock a template from an order for the export variant", async () => {
    // The variant the store recorded decides what was bought, not the browser's
    // custom_data — otherwise a cheaper product could unlock a template.
    await POST(signedRequest(templateOrder(undefined, {
      first_order_item: { variant_id: Number(VARIANT_ID) },
      total: PRICE_CENTS,
    })));
    expect(dbMock.templatePurchase.create).not.toHaveBeenCalled();
  });

  it("will not unlock an export from an order for the template variant", async () => {
    await POST(signedRequest(templateOrder({ site_id: "site_1", user_id: "user_1" })));
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("refuses a variant that matches no known product", async () => {
    await POST(signedRequest(templateOrder(undefined, {
      first_order_item: { variant_id: 777777 },
    })));
    expect(dbMock.templatePurchase.create).not.toHaveBeenCalled();
    expect(dbMock.exportPurchase.create).not.toHaveBeenCalled();
  });

  it("revokes a refunded template purchase", async () => {
    await POST(signedRequest({
      meta: { event_name: "order_refunded" },
      data: { id: "ls_order_1", attributes: { status: "refunded", refunded: true } },
    }));
    expect(dbMock.templatePurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });
});
