import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * What a bad link lands on.
 *
 * Next ships a black screen reading "This page could not be found", with no navigation
 * and nothing to click. Anybody arriving from an old link or a stale search result saw
 * that, which is a worse first impression than the page they were looking for being gone.
 */
const WAYS_ON = [
  { href: "/describe", label: "Describe your business", note: "Write a paragraph and get a site back. The first four are free." },
  { href: "/templates", label: "Browse the templates", note: "Twenty-three finished sites, free, ready to edit." },
  { href: "/examples", label: "See three finished sites", note: "Served as the exact bundles the exporter produces." },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24 pt-24">
        <p className="lc-mono text-sm text-primary-ink">404</p>
        <h1 className="lc-display mt-4 text-4xl md:text-5xl">
          <span className="block">That page is not here.</span>
          <span className="block text-primary-ink">These are.</span>
        </h1>
        <p className="mt-5 text-muted-foreground">
          The address may be mistyped, or the page may have been renamed since whatever
          link brought you here was written.
        </p>

        <ul className="mt-10 space-y-3">
          {WAYS_ON.map(({ href, label, note }) => (
            <li key={href}>
              <Link
                href={href}
                className="block rounded-2xl border border-border bg-card p-5 shadow-[var(--lift-1)] transition-colors hover:border-primary-ink/40"
              >
                <p className="text-foreground">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{note}</p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-muted-foreground">
          Looking for something that used to be here?{" "}
          <Link href="/changelog" className="underline underline-offset-4 hover:text-foreground">
            The changelog
          </Link>{" "}
          records what moved and when.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
