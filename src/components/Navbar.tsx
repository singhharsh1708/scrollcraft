"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, Heart } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import { GITHUB_REPO_URL, GITHUB_SPONSORS_URL } from "@/lib/links";

const NAV_LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/presets",   label: "Styles"    },
  { href: "/pricing",   label: "Pricing"   },
];

export default function Navbar({ position = "sticky" }: { position?: "fixed" | "sticky" | "relative" }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const posClass = position === "fixed"
    ? "fixed top-0 left-0 right-0"
    : position === "sticky"
    ? "sticky top-0"
    : "relative";

  return (
    <nav className={`${posClass} z-50 bg-background/80 backdrop-blur-xl border-b border-white/5`}>
      <div className="flex items-center justify-between px-5 sm:px-8 py-3 sm:py-4 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base sm:text-lg tracking-tight">ScrollCraft</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${pathname === href ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ScrollCraft on GitHub"
            title="ScrollCraft on GitHub"
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <GitHubMark className="w-[18px] h-[18px]" />
          </a>
          {session ? (
            <>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/create">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                  Start Building
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
              </Link>
              <Link href="/create">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                  Start Building
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl px-5 py-4 flex flex-col gap-3">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`text-sm py-1.5 transition-colors ${pathname === href ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {label}
            </Link>
          ))}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm py-1.5 text-muted-foreground"
          >
            <GitHubMark className="w-4 h-4" /> GitHub
          </a>
          <a
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm py-1.5 text-muted-foreground"
          >
            <Heart className="w-4 h-4" /> Sponsor
          </a>
          <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
            {session ? (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full border-white/10">Dashboard</Button>
                </Link>
                <Link href="/create" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white">Start Building</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin" onClick={() => setOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground">Sign In</Button>
                </Link>
                <Link href="/create" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white">Start Building</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
