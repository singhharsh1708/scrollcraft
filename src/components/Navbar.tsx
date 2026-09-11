"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Heart, Menu, X } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import GitHubMark from "@/components/GitHubMark";
import { GITHUB_REPO_URL, GITHUB_SPONSORS_URL } from "@/lib/links";

/**
 * A one-line announcement, then a contained nav that sticks.
 *
 * The announcement sits in normal flow so it scrolls away and only the nav pins. The
 * nav is inset from the edge and bordered rather than full-bleed, so a page's own
 * artwork shows around it.
 */

const NAV_LINKS = [
  { href: "/examples",  label: "Examples"  },
  { href: "/templates", label: "Templates" },
  { href: "/presets",   label: "Presets"   },
  { href: "/changelog", label: "Changelog" },
];

const DOCS_URL = `${GITHUB_REPO_URL}#readme`;

export default function Navbar({ position = "sticky" }: { position?: "fixed" | "sticky" | "relative" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {pathname !== "/examples" && (
        <div className="bg-primary text-white">
          <Link
            href="/examples"
            className="group mx-auto flex max-w-[1360px] flex-col items-center justify-center gap-x-10 gap-y-1 px-4 py-2.5 text-center text-sm sm:flex-row"
          >
            <span>Three finished sites, served as the exact bundles they export to.</span>
            <span className="lc-mono inline-flex items-center gap-2 text-white/85 transition-colors group-hover:text-white">
              See the examples <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      )}

      <div className={`${position === "relative" ? "relative" : "sticky top-0"} z-50 px-3 pt-3 sm:px-6`}>
        <nav
          aria-label="Main"
          className="mx-auto max-w-[1360px] rounded-md border border-border bg-background/80 backdrop-blur-xl"
        >
          <div className="flex h-16 items-center justify-between gap-4 pl-5 pr-2.5">
            <Link href="/" aria-label="ScrollCraft home" className="flex shrink-0 items-center gap-2 text-foreground">
              <BrandMark className="h-5 w-5 text-primary-ink" />
              <span className="text-[1.1rem] font-medium tracking-[-0.02em]">ScrollCraft</span>
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`lc-mono text-sm transition-colors ${
                    isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Docs
              </a>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link href="/create" className="lc-btn lc-btn-solid lc-btn-sm">
                Start building
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-btn lc-btn-ghost lc-btn-sm"
              >
                <GitHubMark className="h-4 w-4" /> GitHub
              </a>
            </div>

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-md text-foreground md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {open && (
            <div id="mobile-menu" className="flex flex-col border-t border-border px-5 pb-5 pt-3 md:hidden">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`lc-mono py-2.5 text-[0.95rem] ${isActive(href) ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </Link>
              ))}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="lc-mono py-2.5 text-[0.95rem] text-muted-foreground"
              >
                Docs
              </a>
              <a
                href={GITHUB_SPONSORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="lc-mono flex items-center gap-2 py-2.5 text-[0.95rem] text-muted-foreground"
              >
                <Heart className="h-4 w-4" aria-hidden="true" /> Sponsor
              </a>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/create" onClick={() => setOpen(false)} className="lc-btn lc-btn-solid lc-btn-sm">
                  Start building
                </Link>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="lc-btn lc-btn-ghost lc-btn-sm"
                >
                  <GitHubMark className="h-4 w-4" /> GitHub
                </a>
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
