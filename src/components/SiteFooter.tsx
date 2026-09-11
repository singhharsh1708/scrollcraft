import Link from "next/link";
import { Heart } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import GitHubMark from "@/components/GitHubMark";
import LinkedInMark from "@/components/LinkedInMark";
import { CONTACT_EMAIL, GITHUB_REPO_URL, GITHUB_SPONSORS_URL, LINKEDIN_URL } from "@/lib/links";

// One footer for every page. Seven pages each carried their own copy, which is why the
// GitHub and sponsor links had nowhere consistent to live.

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "Product",
    links: [
      { label: "Examples", href: "/examples" },
      { label: "Templates", href: "/templates" },
      { label: "Presets", href: "/presets" },
      { label: "Builder", href: "/create" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: `${GITHUB_REPO_URL}#readme`, external: true },
      { label: "Claude Code plugin", href: `${GITHUB_REPO_URL}#installing-the-skill`, external: true },
      { label: "Source code", href: GITHUB_REPO_URL, external: true },
      { label: "Report a bug", href: `${GITHUB_REPO_URL}/issues`, external: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Sponsor", href: GITHUB_SPONSORS_URL, external: true },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
  { label: "Cookie policy", href: "/cookies" },
];

function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
      {link.label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="border-t border-border bg-background px-6 py-8">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandMark className="h-4 w-4 text-primary-ink" />
            <span className="lc-mono">ScrollCraft · open source, MIT licensed</span>
          </div>
          <div className="lc-mono flex items-center gap-6 text-sm text-muted-foreground">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <GitHubMark className="h-4 w-4" /> GitHub
            </a>
            <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" /> Sponsor
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-background text-foreground">
      <div className="mx-auto max-w-[1360px] px-6">
        <div className="grid gap-x-12 gap-y-10 pt-16 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map(({ heading, links }) => (
            <div key={heading} className="border-t border-border pt-8">
              <h2 className="lc-display mb-6 text-2xl text-primary-ink">{heading}</h2>
              <ul className="space-y-1.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor
                      link={link}
                      className="lc-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="border-t border-border pt-8">
            <h2 className="lc-display mb-4 text-2xl text-primary-ink">Built in the open</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              The editor, the templates and the exporter are all on GitHub. Read the source
              before you trust any of it.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="lc-btn lc-btn-solid lc-btn-sm">
                <GitHubMark className="h-4 w-4" /> Star on GitHub
              </a>
              <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer" className="lc-btn lc-btn-ghost lc-btn-sm">
                <Heart className="h-3.5 w-3.5" aria-hidden="true" /> Sponsor
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-muted-foreground">
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="ScrollCraft on GitHub" className="transition-colors hover:text-foreground">
                <GitHubMark className="h-4 w-4" />
              </a>
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="Harsh Singh on LinkedIn" className="transition-colors hover:text-foreground">
                <LinkedInMark className="h-4 w-4" />
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="lc-mono text-xs transition-colors hover:text-foreground">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        {/* The wordmark, outlined and set across the whole width. textLength pins it to
            the viewBox, so it spans edge to edge whatever the font's own metrics are. */}
        <div className="pb-4 pt-16 text-primary-ink/20" aria-hidden="true">
          <svg viewBox="0 0 1200 200" className="h-auto w-full select-none">
            <text
              x="600"
              y="160"
              textAnchor="middle"
              textLength="1170"
              lengthAdjust="spacingAndGlyphs"
              fontSize="200"
              fontWeight="300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              ScrollCraft
            </text>
          </svg>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-7 md:flex-row">
          <p className="lc-mono flex items-center gap-2.5 text-sm text-primary-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-ink" aria-hidden="true" />
            Open source, MIT licensed
          </p>
          <ul className="lc-mono flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {LEGAL.map((link) => (
              <li key={link.label}>
                <FooterAnchor link={link} className="transition-colors hover:text-foreground" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
