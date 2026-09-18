"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { CONTACT_EMAIL, GITHUB_REPO_URL, LINKEDIN_URL } from "@/lib/links";
import GitHubMark from "@/components/GitHubMark";
import LinkedInMark from "@/components/LinkedInMark";
import SiteFooter from "@/components/SiteFooter";

const TOPICS = ["General question", "Custom build", "Bug report", "Feature request", "Enterprise inquiry", "Partnership"];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: TOPICS[0], message: "" });

  // "Describe your project" links arrive with ?topic=custom, so the right topic is already
  // chosen. Read after mount: the page is prerendered without the query string.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("topic")?.toLowerCase();
    const match = wanted ? TOPICS.find((t) => t.toLowerCase().startsWith(wanted)) : undefined;
    if (!match) return;
    const raf = requestAnimationFrame(() => setForm((f) => ({ ...f, topic: match })));
    return () => cancelAnimationFrame(raf);
  }, []);

  /**
   * Composes the message in the visitor's own mail client.
   *
   * There is no server to post to any more, and a form that quietly dropped what it
   * collected is worse than no form. This hands the text to something that can actually
   * deliver it, and the visitor sees exactly what is being sent.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) { toast.error("Please fill all fields"); return; }
    setLoading(true);

    const subject = `[ScrollCraft] ${form.topic} — ${form.name}`;
    const body = [
      form.message,
      "",
      "—",
      `From: ${form.name} <${form.email}>`,
      `Topic: ${form.topic}`,
    ].join("\n");

    // mailto URLs are truncated by some clients past roughly 2000 characters.
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (url.length > 1900) {
      toast.error("That message is too long to hand to your mail app — please shorten it, or email directly.");
      setLoading(false);
      return;
    }

    window.location.href = url;
    setSent(true);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="pt-20 pb-16 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="lc-mono mb-6 text-sm text-primary-ink">Get in touch</p>
          <h1 className="lc-display mb-6 text-5xl md:text-6xl">How can <span className="text-primary-ink">we help?</span></h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Messages come straight to me. Bugs and feature requests are usually better as
            a GitHub issue, where anyone hitting the same thing can follow along.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact options */}
          <div className="space-y-4">
            {[
              { icon: Mail, title: "Email", desc: CONTACT_EMAIL, sub: "Anything at all, including enterprise work", href: `mailto:${CONTACT_EMAIL}` },
              { icon: GitHubMark, title: "GitHub", desc: "singhharsh1708/scrollcraft", sub: "Bugs and feature requests, in the open", href: GITHUB_REPO_URL },
              { icon: LinkedInMark, title: "LinkedIn", desc: "in/singhharsh1708", sub: "For anything more formal", href: LINKEDIN_URL },
            ].map(c => (
              <a
                key={c.title}
                href={c.href}
                {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block p-5 rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors"
              >
                <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center mb-3">
                  <c.icon className="w-4 h-4 text-primary-ink" />
                </div>
                <p className="font-medium text-sm mb-0.5">{c.title}</p>
                <p className="lc-mono text-xs text-primary-ink mb-0.5">{c.desc}</p>
                <p className="lc-mono text-xs text-muted-foreground">{c.sub}</p>
              </a>
            ))}
          </div>

          {/* Form */}
          <div className="md:col-span-2 p-6 sm:p-8 rounded-lg border border-border bg-card">
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-primary-ink" />
                </div>
                <div>
                  <h3 className="lc-display text-2xl mb-2">Your mail app should be open</h3>
                  <p className="text-muted-foreground text-sm">
                    Nothing is sent until you press send there. If it did not open, email{" "}
                    {CONTACT_EMAIL} directly.
                  </p>
                </div>
                <Button onClick={() => setSent(false)} variant="outline" className="border-border mt-2">Write another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="contact-name" className="lc-mono text-xs text-muted-foreground">Name</label>
                    <Input id="contact-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="contact-email" className="lc-mono text-xs text-muted-foreground">Email</label>
                    <Input id="contact-email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" type="email" className="bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {/* A pill group, not a text field: named as a group so a screen reader
                      announces what the pressed state belongs to. */}
                  <span id="contact-topic-label" className="lc-mono block text-xs text-muted-foreground">Topic</span>
                  <div role="group" aria-labelledby="contact-topic-label" className="flex flex-wrap gap-2">
                    {TOPICS.map(t => (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, topic: t }))}
                        aria-pressed={form.topic === t}
                        className={`lc-mono h-9 px-4 rounded-full text-[0.8rem] border transition-colors ${form.topic === t ? "border-primary-ink/60 bg-primary-ink/15 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-message" className="lc-mono text-xs text-muted-foreground">Message</label>
                  <Textarea id="contact-message" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder={form.topic === "Custom build" ? "What is the site for, what do you already have (footage, copy, brand), and when do you need it?" : "Tell us what's on your mind..."} className="bg-background border-border min-h-[140px] resize-none" />
                </div>
                <button type="submit" disabled={loading} className="lc-btn lc-btn-solid w-full disabled:opacity-60">
                  {loading ? "Opening…" : "Compose message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
