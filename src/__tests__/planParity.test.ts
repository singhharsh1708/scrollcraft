import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { PLANS, PAID_PLAN_NAMES, planByName, formatINR } from "@/lib/plans";

// The charged amount and the advertised amount used to be declared in separate tables
// that had already drifted. They now share one source; this holds them together by
// driving the real checkout endpoint and comparing what it charges against plans.ts.

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  promoCode: { findUnique: vi.fn() },
  payment: { count: vi.fn(), create: vi.fn() },
}));
const ordersCreate = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate, fetch: vi.fn() };
    constructor() {}
  },
}));

type CreateOrder = typeof import("../app/api/payments/create-order/route").POST;
let createOrder: CreateOrder;

function req(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/payments/create-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  rateLimitMock.mockResolvedValue({ allowed: true });
  dbMock.user.findUnique.mockResolvedValue({ id: "u1" });
  dbMock.promoCode.findUnique.mockResolvedValue(null);
  dbMock.payment.count.mockResolvedValue(0);
  dbMock.payment.create.mockResolvedValue({ id: "p1" });
  ordersCreate.mockImplementation(async (args: { amount: number }) => ({
    id: "order_1", amount: args.amount, currency: "INR",
  }));
  ({ POST: createOrder } = await import("../app/api/payments/create-order/route"));
});

afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

async function chargedAmount(plan: string, billing: "monthly" | "annual"): Promise<number> {
  const res = await createOrder(req({ plan, billing }));
  expect(res.status).toBe(200);
  return ordersCreate.mock.calls.at(-1)![0].amount as number;
}

describe("checkout charges what plans.ts advertises", () => {
  it("accepts exactly the paid plans, and no free one", () => {
    expect(PAID_PLAN_NAMES).toEqual(["Basic", "Basic Plus", "Pro", "Premium"]);
    expect(PAID_PLAN_NAMES).not.toContain(PLANS.FREE.name);
  });

  for (const name of ["Basic", "Basic Plus", "Pro", "Premium"]) {
    it(`charges ${name} monthly at its advertised rate`, async () => {
      expect(await chargedAmount(name, "monthly")).toBe(planByName(name)!.monthlyPaise);
    });

    it(`charges ${name} annually at twelve times its advertised monthly-equivalent`, async () => {
      expect(await chargedAmount(name, "annual")).toBe(planByName(name)!.annualPaise * 12);
    });
  }

  it("rejects a plan name that is not a paid plan", async () => {
    const res = await createOrder(req({ plan: "Free Trial", billing: "monthly" }));
    expect(res.status).toBe(400);
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("keeps the annual rate a genuine discount on the monthly one", () => {
    for (const name of PAID_PLAN_NAMES) {
      const p = planByName(name)!;
      expect(p.annualPaise).toBeLessThan(p.monthlyPaise);
    }
  });

  it("formats paise as whole rupees, matching what the pricing page renders", () => {
    expect(formatINR(199900)).toBe("₹1,999");
    expect(formatINR(1499900)).toBe("₹14,999");
  });
});
