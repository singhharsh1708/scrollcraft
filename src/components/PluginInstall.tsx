"use client";
import { useState } from "react";
import { ArrowUpRight, Check, Copy, Terminal } from "lucide-react";
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
    <div id="plugin" className="rounded-lg border border-border bg-card p-6 sm:p-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="lc-mono mb-5 flex items-center gap-2 text-sm text-primary-ink">
            <Terminal className="h-4 w-4" aria-hidden="true" /> Or build it from your editor
          </p>
          <h3 className="lc-display text-3xl sm:text-4xl">ScrollCraft as a Claude Code plugin</h3>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            Scaffold a spec, render a background and build the site from the command line.
            The only thing it needs installed is <code className="lc-mono text-foreground">ffmpeg</code>.
          </p>
          <a
            href={`${GITHUB_REPO_URL}#installing-the-skill`}
            target="_blank"
            rel="noopener noreferrer"
            className="lc-link mt-6"
          >
            What the plugin does <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <ul className="space-y-2">
          {COMMANDS.map((cmd) => (
            <li key={cmd}>
              <button
                type="button"
                onClick={() => copy(cmd)}
                aria-label={`Copy command: ${cmd}`}
                className="group flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3.5 text-left transition-colors hover:border-foreground/30"
              >
                <code className="lc-mono truncate text-xs text-foreground sm:text-sm">{cmd}</code>
                {copied === cmd ? (
                  <span className="lc-mono flex flex-shrink-0 items-center gap-1.5 text-xs text-primary-ink">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Copied
                  </span>
                ) : (
                  <Copy
                    className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
