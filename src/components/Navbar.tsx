"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Heart, Menu, X } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import GitHubMark from "@/components/GitHubMark";
import { GITHUB_REPO_URL, GITHUB_SPONSORS_URL } from "@/lib/links";
import { endSession, startGitHubSignIn } from "@/app/signin/actions";

/**
 * A one-line announcement, then a glass nav that sticks.
 *
 * The announcement sits in normal flow so it scrolls away and only the nav pins. The nav
 * is a full-width pane of frosted glass rather than a box: the page moving under it glows
 * through, blurred and saturated, the way Apple's does.
 */

/**
 * Four links, not eight.
 *
 * Somebody arriving wants a site, and the nav was offering them the component kit, the
 * preset library and the release notes alongside the product. Those are for people who
 * already use this, and the footer is where they now live.
 */
const NAV_LINKS = [
  { href: "/describe",  label: "Describe"  },
  { href: "/templates", label: "Templates" },
  { href: "/examples",  label: "Examples"  },
  { href: "/pricing",   label: "Pricing"   },
];

const DOCS_URL = `${GITHUB_REPO_URL}#readme`;

type Viewer = { name?: string | null; image?: string | null };

/**
 * Who is signed in, or nothing at all.
 *
 * Asked for over HTTP rather than through a provider, because the nav is mounted by a
 * layout that knows nothing about this. A deployment with no GitHub app answers 404 to
 * that endpoint, and the state stays null, which renders exactly the nav that was here
 * before sign-in existed.
 */
function useViewer(): Viewer | "signed-out" | null {
  const [viewer, setViewer] = useState<Viewer | "signed-out" | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const body = (await res.json()) as { user?: Viewer } | null;
        if (live) setViewer(body?.user ?? "signed-out");
      } catch {
        // Nothing to offer is the right answer to a session that cannot be read.
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return viewer;
}

/**
 * `floating` is the landing page's nav: the same links in a rounded bar that sits over
 * the hero rather than cutting a line across it. Everything else about it is unchanged,
 * so the two variants cannot drift apart.
 */
export default function Navbar({
  position = "sticky",
  variant = "band",
}: {
  position?: "fixed" | "sticky" | "relative";
  variant?: "band" | "floating";
}) {
  const pathname = usePathname();
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Whether a pale band is under the nav's midline right now. Checked on scroll and
  // resize, at most once a frame, and only against the handful of bands on the page.
  const navRef = useRef<HTMLElement>(null);
  const [onLight, setOnLight] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const nav = navRef.current;
      if (!nav) return;
      const r = nav.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const light = Array.from(document.querySelectorAll<HTMLElement>(".band-light")).some((band) => {
        const b = band.getBoundingClientRect();
        return b.top <= y && b.bottom >= y;
      });
      setOnLight((prev) => (prev === light ? prev : light));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return (
    <>
      {pathname !== "/examples" && pathname !== "/describe" && (
        <div className="border-b border-white/[0.06] bg-card/40 text-foreground/80 backdrop-blur-sm">
          <Link
            href="/examples"
            className="group mx-auto flex max-w-[1360px] flex-col items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] sm:flex-row"
          >
            <span>Three finished sites, served as the exact bundles they export to.</span>
            <span className="inline-flex items-center gap-1.5 text-primary-ink transition-colors group-hover:text-foreground">
              See the examples <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      )}

      <div className={`${position === "relative" ? "relative" : "sticky top-0"} z-50 ${variant === "floating" ? "px-4 pt-4" : ""}`}>
        <nav
          ref={navRef}
          aria-label="Main"
          data-surface={onLight ? "light" : "dark"}
          // Apple's recipe, read off apple.com: saturate(1.8) blur(20px) over a translucent
          // ground. The pale band keeps a near-opaque ground: at 90% the blur pulled in the
          // dark card panels inside the band and took the links to 3.83:1.
          className={`w-full backdrop-blur-[20px] backdrop-saturate-[1.8] transition-colors duration-300 ${
            variant === "floating"
              // Rounded like a pill only while it is one line tall. With the menu open it
              // is a panel, and a full radius on a panel draws an ellipse around the links.
              ? `mx-auto max-w-[1360px] border shadow-[var(--lift-2)] ${open ? "rounded-2xl" : "rounded-full"}`
              : "border-b"
          } ${onLight ? "nav-on-light border-black/10 bg-band/95" : "border-white/[0.08] bg-background/70"}`}
        >
          <div className={`mx-auto flex h-[var(--nav-h)] max-w-[1360px] items-center justify-between gap-4 pl-6 pr-3 ${variant === "floating" ? "sm:pl-7 sm:pr-3" : "sm:px-6"}`}>
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
                    isActive(href) ? "text-foreground" : "text-foreground/75 hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-mono text-sm text-foreground/75 transition-colors hover:text-foreground"
              >
                Docs
              </a>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link href="/describe" className="lc-btn lc-btn-solid lc-btn-sm">
                Get started
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-btn lc-btn-ghost lc-btn-sm"
              >
                <GitHubMark className="h-4 w-4" /> GitHub
              </a>
              {viewer === "signed-out" && (
                <form action={startGitHubSignIn}>
                  <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm">
                    <GitHubMark className="h-4 w-4" /> Sign in
                  </button>
                </form>
              )}
              {viewer && viewer !== "signed-out" && (
                <form action={endSession} className="flex items-center gap-2">
                  {viewer.image && (
                    // unoptimized: the avatar comes from GitHub's CDN, and optimising it
                    // would mean naming that host in the image config.
                    <Image
                      unoptimized
                      src={viewer.image}
                      alt={viewer.name ? `${viewer.name}, signed in` : "Signed in"}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full"
                    />
                  )}
                  <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm">
                    Sign out
                  </button>
                </form>
              )}
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
                  className={`lc-mono py-2.5 text-[0.95rem] ${isActive(href) ? "text-foreground" : "text-foreground/75"}`}
                >
                  {label}
                </Link>
              ))}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="lc-mono py-2.5 text-[0.95rem] text-foreground/75"
              >
                Docs
              </a>
              <a
                href={GITHUB_SPONSORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="lc-mono flex items-center gap-2 py-2.5 text-[0.95rem] text-foreground/75"
              >
                <Heart className="h-4 w-4" aria-hidden="true" /> Sponsor
              </a>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/describe" onClick={() => setOpen(false)} className="lc-btn lc-btn-solid lc-btn-sm">
                  Get started
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
                {viewer === "signed-out" && (
                  <form action={startGitHubSignIn} className="col-span-2">
                    <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm w-full">
                      <GitHubMark className="h-4 w-4" /> Sign in
                    </button>
                  </form>
                )}
                {viewer && viewer !== "signed-out" && (
                  <form action={endSession} className="col-span-2 flex items-center gap-2">
                    {viewer.image && (
                      <Image
                        unoptimized
                        src={viewer.image}
                        alt={viewer.name ? `${viewer.name}, signed in` : "Signed in"}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full"
                      />
                    )}
                    <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm flex-1">
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
