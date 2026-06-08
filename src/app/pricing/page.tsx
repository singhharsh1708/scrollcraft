"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Sparkles, Zap, Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    name: "Free Trial",
    monthly: 0,
    annual: 0,
    description: "Try everything, no card needed",
    badge: null,
    cta: "Start free",
    ctaVariant: "outline" as const,
    highlight: false,
    credits: "100 AI credits",
    features: [
      "100 AI credits",
      "1 website",
      "Free subdomain",
      "720p video generation",
      "ZIP export",
      "Community support",
    ],
    missing: [
      "Custom domain",
      "Design-change chats",
      "Image upscaling",
      "Cloud save",
    ],
  },
  {
    name: "Basic",
    monthly: 25,
    annual: 20,
    description: "Perfect for freelancers & side projects",
    badge: null,
    cta: "Get Basic",
    ctaVariant: "outline" as const,
    highlight: false,
    credits: "1,500 credits / mo",
    features: [
      "1,500 AI credits / month",
      "2 full scroll websites",
      "Free subdomain",
      "30 images / 15 videos",
      "20 design-change chats",
      "HD image generation",
      "720p video generation",
      "ZIP export",
      "Email support",
    ],
    missing: [
      "Custom domain",
      "1080p video generation",
      "Image upscaling",
      "Cloud save",
    ],
  },
  {
    name: "Basic Plus",
    monthly: 40,
    annual: 32,
    description: "More credits, more sites",
    badge: null,
    cta: "Get Basic Plus",
    ctaVariant: "outline" as const,
    highlight: false,
    credits: "2,500 credits / mo",
    features: [
      "2,500 AI credits / month",
      "4 full scroll websites",
      "Free subdomain",
      "50 images / 25 videos",
      "35 design-change chats",
      "HD image generation",
      "720p video generation",
      "ZIP export",
      "Priority email support",
    ],
    missing: [
      "Custom domain",
      "1080p video generation",
      "Image upscaling",
      "Cloud save",
    ],
  },
  {
    name: "Pro",
    monthly: 60,
    annual: 48,
    description: "For serious builders & agencies",
    badge: "Most Popular",
    cta: "Get Pro",
    ctaVariant: "default" as const,
    highlight: true,
    credits: "6,000 credits / mo",
    features: [
      "6,000 AI credits / month",
      "7 full scroll websites",
      "Free subdomain",
      "Custom domain support",
      "120 images / 60 videos",
      "40 design-change chats",
      "HD + 1080p video generation",
      "All base AI models",
      "Image upscaling",
      "ZIP export",
      "Priority support",
    ],
    missing: [
      "4K video generation",
      "Cloud save",
      "Business OS",
    ],
  },
  {
    name: "Premium",
    monthly: 200,
    annual: 160,
    description: "Maximum power for power users",
    badge: null,
    cta: "Get Premium",
    ctaVariant: "outline" as const,
    highlight: false,
    credits: "25,000 credits / mo",
    features: [
      "25,000 AI credits / month",
      "30 full scroll websites",
      "Free subdomain",
      "Custom domain support",
      "500 images / 250 videos",
      "160 design-change chats",
      "HD + 1080p + 4K video",
      "All base AI models",
      "Image upscaling",
      "Full cloud save",
      "Business OS",
      "REST API access",
      "Dedicated support",
    ],
    missing: [],
  },
];

const FAQ = [
  {
    q: "What is an AI credit?",
    a: "Credits are consumed when you generate images or videos. Roughly: 1 image = 1 credit, 1 video = 50 credits. Unused credits don't roll over.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your dashboard at any time — you keep access until the end of your billing period.",
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
    q: "Can I bring my own AI API key?",
    a: "Yes on Pro and above — connect your own Fal.ai, Gemini, or Luma AI key to use your own quota.",
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
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            toast.success(`${planName} activated! Welcome aboard.`);
            window.location.href = `/create?plan=${encodeURIComponent(planName)}`;
          } else {
            toast.error("Payment verification failed. Contact support.");
          }
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/presets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Presets</Link>
          <Link href="/pricing" className="text-sm text-foreground font-medium">Pricing</Link>
          <Link href="/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Start Building</Button>
          </Link>
        </div>
      </nav>

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
          Every plan includes our full animated scroll engine, ZIP export, and canvas generation.
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
                    ${annual ? plan.annual : plan.monthly}
                  </span>
                  <span className="text-muted-foreground text-sm mb-1">/mo</span>
                </div>
                {plan.annual > 0 && annual && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Billed ${plan.annual * 12}/yr
                  </p>
                )}
                {plan.annual === 0 && (
                  <p className="text-xs text-primary mt-0.5 font-medium">No credit card needed</p>
                )}
              </div>

              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/8 text-xs w-fit">
                {plan.credits}
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
              Custom scroll websites built for your brand by our team. White-label, dedicated infrastructure, SLA, and custom AI model training.
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
                { label: "AI credits / mo", values: ["100", "1,500", "2,500", "6,000", "25,000"] },
                { label: "Websites", values: ["1", "2", "4", "7", "30"] },
                { label: "Design-change chats", values: ["—", "20", "35", "40", "160"] },
                { label: "Video resolution", values: ["720p", "720p", "720p", "1080p", "4K"] },
                { label: "Image upscaling", values: [false, false, false, true, true] },
                { label: "Custom domain", values: [false, false, false, true, true] },
                { label: "Full cloud save", values: [false, false, false, false, true] },
                { label: "REST API access", values: [false, false, false, false, true] },
                { label: "Business OS", values: [false, false, false, false, true] },
                { label: "ZIP export", values: [true, true, true, true, true] },
                { label: "Bring your own API key", values: [false, false, false, true, true] },
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
          7 days free. No card required.
        </h2>
        <p className="text-muted-foreground mb-8">Try the full Pro experience — upgrade only when you love it.</p>
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
          ScrollCraft — Built with Next.js & AI
        </div>
      </footer>
    </main>
  );
}
