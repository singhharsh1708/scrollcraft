"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const TOPICS = ["General question", "Bug report", "Feature request", "Enterprise inquiry", "Billing", "Partnership"];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: TOPICS[0], message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Couldn't send your message. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Couldn't send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="pt-20 pb-16 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">Get in touch</Badge>
          <h1 className="text-5xl font-black tracking-tighter mb-4">How can we help?</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            We typically reply within a few hours. For urgent issues, tag us on Twitter.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact options */}
          <div className="space-y-4">
            {[
              { icon: Mail, title: "Email us", desc: "hello@scrollcraft.app", sub: "For general inquiries" },
              { icon: MessageSquare, title: "Live chat", desc: "Chat in the app", sub: "Mon–Fri, 9am–6pm IST" },
              { icon: Zap, title: "Enterprise", desc: "enterprise@scrollcraft.app", sub: "Custom builds & white-label" },
            ].map(c => (
              <div key={c.title} className="p-5 rounded-2xl border border-white/8 bg-card">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                  <c.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="font-semibold text-sm mb-0.5">{c.title}</p>
                <p className="text-xs text-primary mb-0.5">{c.desc}</p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="md:col-span-2 p-6 rounded-2xl border border-white/8 bg-card">
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Message sent!</h3>
                  <p className="text-muted-foreground text-sm">We&apos;ll get back to you within a few hours.</p>
                </div>
                <Button onClick={() => setSent(false)} variant="outline" className="border-white/10 mt-2">Send another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" className="bg-white/5 border-white/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Email</label>
                    <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" type="email" className="bg-white/5 border-white/10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Topic</label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map(t => (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, topic: t }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.topic === t ? "bg-primary text-white border-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Message</label>
                  <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell us what's on your mind..." className="bg-white/5 border-white/10 min-h-[140px] resize-none" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-5">
                  {loading ? "Sending..." : "Send message"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter compact />
    </main>
  );
}
