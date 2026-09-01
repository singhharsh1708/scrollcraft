"use client";
import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { GITHUB_REPO_URL } from "@/lib/links";

/**
 * The other way to use ScrollCraft.
 *
 * The repository ships a Claude Code plugin that builds and verifies a scroll site from
 * the command line, and the site never said so - a whole distribution channel reachable
 * only by reading the README on GitHub. Two lines, copyable, because that is the entire
 * install.
 */
const COMMANDS = [
  "/plugin marketplace add singhharsh1708/scrollcraft",
  "/plugin install scrollcraft@scrollcraft",
];

export default function PluginInstall() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(cmd);
      window.setTimeout(() => setCopied((c) => (c === cmd ? null : c)), 1600);
    } catch {
      // Clipboard access can be denied outright; the command is selectable either way.
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-2 text-primary-ink">
        <Terminal className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs uppercase tracking-widest font-medium">Or build it from your editor</span>
      </div>
      <h3 className="text-2xl font-bold tracking-tight mb-2">ScrollCraft as a Claude Code plugin</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xl">
        Scaffold a spec, render a background and build the site from the command line.
        The only thing it needs installed is <code className="text-foreground">ffmpeg</code>.
      </p>

      <ul className="space-y-2">
        {COMMANDS.map((cmd) => (
          <li key={cmd}>
            <button
              type="button"
              onClick={() => copy(cmd)}
              aria-label={`Copy command: ${cmd}`}
              className="group w-full flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-left transition-colors hover:border-white/20"
            >
              <code className="text-xs sm:text-sm font-mono text-foreground/90 truncate">{cmd}</code>
              {copied === cmd ? (
                <span className="flex items-center gap-1.5 text-xs text-primary-ink flex-shrink-0">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Copied
                </span>
              ) : (
                <Copy
                  className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors"
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      <a
        href={`${GITHUB_REPO_URL}#install-the-claude-code-plugin`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        What the plugin does →
      </a>
    </div>
  );
}
