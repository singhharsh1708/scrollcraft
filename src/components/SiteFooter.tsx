import Link from "next/link";
import { Sparkles, Heart } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import { GITHUB_REPO_URL, GITHUB_SPONSORS_URL } from "@/lib/links";

// One footer for every page. Seven pages each carried their own copy, which is why the
// GitHub and sponsor links had nowhere consistent to live.

const COLUMNS: Array<[string, Array<[string, string]>]> = [
  ["Product", [["Templates", "/templates"], ["Styles", "/presets"], ["Pricing", "/pricing"], ["Builder", "/create"]]],
  ["Company", [["About", "/about"], ["Changelog", "/changelog"], ["Contact", "/contact"]]],
  ["Legal", [["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Cookie Policy", "/cookies"]]],
];

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            ScrollCraft — open source, built with Next.js
          </div>
          <div className="flex items-center gap-4">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GitHubMark className="w-4 h-4" /> GitHub
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-pink-300 transition-colors"
            >
              <Heart className="w-3.5 h-3.5" /> Sponsor
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="py-12 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary" />
              </div>
              <span className="font-semibold">ScrollCraft</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Ready-made cinematic scroll templates with animated canvas backgrounds.
              Open source, and free to use.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ScrollCraft on GitHub"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <GitHubMark className="w-4 h-4" />
              </a>
              <a
                href={GITHUB_SPONSORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Sponsor ScrollCraft"
                className="text-muted-foreground hover:text-pink-300 transition-colors"
              >
                <Heart className="w-4 h-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map(([heading, links]) => (
            <div key={heading}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                {heading}
              </p>
              <div className="space-y-2.5">
                {links.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 gap-4">
          <p className="text-xs text-muted-foreground">© 2026 ScrollCraft. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GitHubMark className="w-3.5 h-3.5" /> Star on GitHub
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-pink-300 transition-colors"
            >
              <Heart className="w-3 h-3" /> Sponsor
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
