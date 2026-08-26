import { Button } from "@/components/ui/button";
import { Heart, Star } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import { GITHUB_REPO_URL, GITHUB_SPONSORS_URL } from "@/lib/links";

/**
 * The open-source ask: star the repo, or sponsor it.
 *
 * Deliberately no live star count. It would mean an external fetch on render that the
 * page does not need, and a number that is wrong when the request fails.
 */
export default function SponsorCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="border-white/10 h-8 text-xs gap-1.5">
            <GitHubMark className="w-3.5 h-3.5" /> Star on GitHub
          </Button>
        </a>
        <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="border-pink-400/30 text-pink-300 hover:bg-pink-400/10 h-8 text-xs gap-1.5">
            <Heart className="w-3.5 h-3.5" /> Sponsor
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-card p-7 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <GitHubMark className="w-5 h-5 text-foreground" />
            <span className="font-semibold">Built in the open</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            ScrollCraft is free because it is open source. The whole thing — the scroll
            engine, the templates, the exporter — is on GitHub, and you can read it, fork
            it, or file the bug you just hit. If it saved you a weekend, sponsoring keeps
            it maintained.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 shrink-0 md:w-52">
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 gap-2">
              <Star className="w-4 h-4" /> Star the repo
            </Button>
          </a>
          <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer">
            <Button className="w-full bg-pink-500 hover:bg-pink-500/90 text-white gap-2 font-semibold">
              <Heart className="w-4 h-4" /> Sponsor
            </Button>
          </a>
          <p className="text-[11px] text-muted-foreground/70 text-center">
            Sponsorship goes to hosting and maintenance.
          </p>
        </div>
      </div>
    </div>
  );
}
