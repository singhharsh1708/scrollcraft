"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Sparkles, Zap, Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { planByName, formatINR } from "@/lib/plans";

const PLANS = [
  {
    name: "Free Trial",
    monthly: 0,
    annual: 0,
    description: "Every template, no card needed",
    badge: null,
    cta: "Start free",
    ctaVariant: "outline" as const,
    highlight: false,
    allowance: "1 website",
    features: [
      "Every template",
      "1 saved website",
      "Publish to a hosted link, with a ScrollCraft badge",
      "Visual editor",
      "Community support",
    ],
    missing: [
      "ZIP export included (buy per site, or upgrade)",
      "More than one saved website",
      "Badge-free published pages",
      "Priority support",
    ],
  },
  {
    name: "Basic",
    monthly: 25,
    annual: 20,
    description: "For freelancers and side projects",
    badge: null,
    cta: "Get Basic",
    ctaVariant: "outline" as const,
    highlight: false,
    allowance: "2 websites",
    features: [
      "Every template",
      "2 saved websites",
      "Publish to a hosted link, badge-free",
      "Visual editor",
      "ZIP export",
      "Email support",
    ],
    missing: [
      "Priority support",
    ],
  },
  {
    name: "Basic Plus",
    monthly: 37,
    annual: 30,
    description: "For people shipping more than one thing",
    badge: null,
    cta: "Get Basic Plus",
    ctaVariant: "outline" as const,
    highlight: false,
    allowance: "4 websites",
    features: [
      "Every template",
      "4 saved websites",
      "Publish to a hosted link, badge-free",
      "Visual editor",
      "ZIP export",
      "Email support",
    ],
    missing: [
      "Priority support",
    ],
  },
  {
    name: "Pro",
    monthly: 62,
    annual: 50,
    description: "For studios and agencies",
    badge: "Most popular",
    cta: "Get Pro",
    ctaVariant: "default" as const,
    highlight: true,
    allowance: "7 websites",
    features: [
      "Every template",
      "7 saved websites",
      "Publish to a hosted link, badge-free",
      "Visual editor",
      "ZIP export",
      "Priority support",
    ],
    missing: [],
  },
  {
    name: "Premium",
    monthly: 187,
    annual: 150,
    description: "For teams running many sites",
    badge: null,
    cta: "Get Premium",
    ctaVariant: "outline" as const,
    highlight: false,
    allowance: "30 websites",
    features: [
      "Every template",
      "30 saved websites",
      "Publish to a hosted link, badge-free",
      "Visual editor",
      "ZIP export",
      "Priority support",
    ],
    missing: [],
  },
];

const FAQ = [
  {
    q: "Are the templates really free?",
    a: "Yes. Every template is available on every plan, including the free one. Exporting a site to a ZIP you own outright is included on the paid plans, or you can buy an export for a single site.",
  },
  {
    q: "What do the paid plans actually add?",
    a: "ZIP export without buying it per site, how many websites you can keep saved and published, badge-free published pages that search engines index, and how quickly we answer support. Nothing about the templates themselves is gated.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Email hello@scrollcraft.app to cancel — you keep access until the end of your billing period.",
  },
  {
    q: "What's the difference between monthly and annual?",
    a: "Annual billing saves you 20%. You're charged once per year upfront.",
  },
  {
    q: "Do I own the exported code?",
    a: "Yes, 100%. You can modify, host, resell, or white-label any site you export.",
  },
  {
    q: "Is there an enterprise plan?",
    a: "Yes. We build custom scroll websites for your brand and offer white-label solutions. Contact us for pricing.",
  },
];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(script);
  });
}

// Displayed prices must match what create-order actually charges. The page rendered
// dollar amounts ("$200/mo") against a Razorpay order billed in INR (₹14,999) — the
// wrong symbol and a different number at the moment of payment.
function priceLabel(name: string, annual: boolean): string {
  const p = planByName(name);
  if (!p) return "—";
  const paise = annual ? p.annualPaise : p.monthlyPaise;
  return paise === 0 ? "Free" : formatINR(paise);
}

function annualTotalLabel(name: string): string {
  const p = planByName(name);
  return p ? formatINR(p.annualPaise * 12) : "—";
}

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPct: number } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      setPromoApplied({ code: data.code, discountPct: data.discountPct });
      toast.success(`${data.discountPct}% discount applied!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid promo code");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleCheckout = async (planName: string) => {
    if (status !== "authenticated") {
      router.push("/auth/signin?callbackUrl=/pricing");
      return;
    }
    setCheckingOut(planName);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planName,
          billing: annual ? "annual" : "monthly",
          ...(promoApplied ? { promoCode: promoApplied.code } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "ScrollCraft",
        description: `${planName} plan — ${annual ? "Annual" : "Monthly"}`,
        theme: { color: "#7c3aed" },
        // The user has already been charged by the time this runs, so nothing in here
        // may throw unhandled — an unhandled rejection left them with no toast, no
        // redirect and no way to know whether the payment landed.
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && verifyData.success) {
              toast.success(`${planName} activated! Welcome aboard.`);
              window.location.href = `/create?plan=${encodeURIComponent(planName)}`;
              return;
            }
            // Surface the reason the server gave instead of one generic string.
            toast.error(
              verifyData.error
                ? `${verifyData.error} Your payment went through — contact support if this persists.`
                : "We couldn't confirm your payment. Contact support with your payment ID."
            );
          } catch {
            toast.error("Your payment went through but we couldn't confirm it. Contact support before paying again.");
          } finally {
            setCheckingOut(null);
          }
        },
        modal: {
          // Without this the button left its "Processing…" state as soon as the modal
          // opened, so dismissing and clicking again created more orders — five cycles
          // hit the 5/hour create-order limit and locked the user out of buying at all.
          ondismiss: () => setCheckingOut(null),
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setCheckingOut(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <Navbar />

      {/* Header */}
      <section className="pt-20 pb-12 text-center px-6">
        <div className="absolute left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Zap className="w-3 h-3 mr-1.5" /> Simple, transparent pricing
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          Start free.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
            Scale when ready.
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
          Every plan includes the full animated scroll engine and visual editor. ZIP export is included on every paid plan, or buy it per site.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-2 py-1.5">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!annual ? "bg-white text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${annual ? "bg-white text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Annual
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${annual ? "bg-primary text-white" : "bg-primary/20 text-primary"}`}>
              –20%
            </span>
          </button>
        </div>

        {/* Promo code */}
        <div className="mt-6 flex flex-col items-center gap-3">
          {promoApplied ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium">
              <Check className="w-4 h-4" />
              <span>Code <strong>{promoApplied.code}</strong> — {promoApplied.discountPct}% off applied</span>
              <button onClick={() => { setPromoApplied(null); setPromoInput(""); }} className="hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  aria-label="Promo code"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  placeholder="Promo code"
                  className="pl-8 pr-3 py-2 text-sm rounded-lg border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500/50 w-36 placeholder:text-muted-foreground"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyPromo}
                disabled={validatingPromo || !promoInput.trim()}
              >
                {validatingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                plan.highlight
                  ? "border-primary bg-primary/8 shadow-xl shadow-primary/10"
                  : "border-white/8 bg-card hover:border-white/15"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white border-0 px-3 py-0.5 text-xs font-semibold shadow-lg shadow-primary/30">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div>
                <p className="font-semibold text-sm mb-0.5">{plan.name}</p>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>

              <div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tighter">
                    {priceLabel(plan.name, annual)}
                  </span>
                  <span className="text-muted-foreground text-sm mb-1">/mo</span>
                </div>
                {plan.annual > 0 && annual && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Billed {annualTotalLabel(plan.name)}/yr
                  </p>
                )}
                {plan.annual === 0 && (
                  <p className="text-xs text-primary mt-0.5 font-medium">No credit card needed</p>
                )}
              </div>

              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/8 text-xs w-fit">
                {plan.allowance}
              </Badge>

              <div className="mt-auto">
                {plan.monthly === 0 ? (
                  <Link href={`/create?plan=${encodeURIComponent(plan.name)}`}>
                    <Button
                      className={`w-full font-semibold text-sm bg-white/8 hover:bg-white/12 text-foreground border border-white/10`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => handleCheckout(plan.name)}
                    disabled={checkingOut === plan.name}
                    className={`w-full font-semibold text-sm ${
                      plan.highlight
                        ? "bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25"
                        : "bg-white/8 hover:bg-white/12 text-foreground border border-white/10"
                    }`}
                  >
                    {checkingOut === plan.name
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processing…</>
                      : plan.cta}
                  </Button>
                )}
              </div>

              <div className="border-t border-white/8 pt-4 space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
                {plan.missing.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground/50">
                    <Minus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mt-6 rounded-2xl border border-white/8 bg-card p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-lg mb-1">Enterprise</p>
            <p className="text-muted-foreground text-sm max-w-md">
              Custom scroll websites built for your brand by our team. White-label, dedicated infrastructure, and an SLA.
            </p>
          </div>
          <Link href="mailto:hello@scrollcraft.app">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 whitespace-nowrap px-8">
              Contact us
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <h2 className="text-2xl font-black tracking-tighter text-center mb-8">Full comparison</h2>
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-1/3">Feature</th>
                {PLANS.map(p => (
                  <th key={p.name} className={`text-center px-3 py-3 font-semibold text-xs ${p.highlight ? "text-primary" : ""}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Templates", values: ["All", "All", "All", "All", "All"] },
                { label: "Saved websites", values: ["1", "2", "4", "7", "30"] },
                { label: "Published sites", values: ["1", "2", "4", "7", "30"] },
                { label: "Badge-free pages", values: [false, true, true, true, true] },
                { label: "Visual editor", values: [true, true, true, true, true] },
                { label: "ZIP export", values: [false, true, true, true, true] },
              ].map((row, i) => (
                <tr key={row.label} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/2"}`}>
                  <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                  {row.values.map((v, vi) => (
                    <td key={vi} className="text-center px-3 py-3">
                      {typeof v === "boolean" ? (
                        v ? <Check className="w-4 h-4 text-primary mx-auto" /> : <Minus className="w-4 h-4 text-white/20 mx-auto" />
                      ) : (
                        <span className={PLANS[vi].highlight ? "text-primary font-medium" : ""}>{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <h2 className="text-2xl font-black tracking-tighter text-center mb-8">Frequently asked</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/8 bg-card overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/3 transition-colors"
              >
                <span className="font-medium text-sm">{item.q}</span>
                <span className={`text-muted-foreground text-lg leading-none transition-transform flex-shrink-0 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-24 px-6 text-center border-t border-white/5 pt-20">
        <h2 className="text-4xl font-black tracking-tighter mb-4">
          Start free. No card required.
        </h2>
        <p className="text-muted-foreground mb-8">Every template, one saved website, no time limit.</p>
        <Link href="/create">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-base font-semibold shadow-xl shadow-primary/30">
            Start for free <Sparkles className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          ScrollCraft — Built with Next.js
        </div>
      </footer>
    </main>
  );
}
