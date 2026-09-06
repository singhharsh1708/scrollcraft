"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sectionsSchema, type Section } from "@/lib/siteSchema";

/**
 * Rewriting the site's copy from one plain-language instruction.
 *
 * The result is handed back to the editor and applied through its undo stack, so a
 * rewrite the user dislikes costs one keystroke to reverse. Nothing is applied unless the
 * response parses as a section list, because the editor's document is not a place to put
 * whatever came back.
 */

const MAX_INSTRUCTION_CHARS = 600;

const SUGGESTIONS = [
  "Make every heading shorter and punchier",
  "Rewrite it for a small bakery",
  "Translate the copy to Hindi",
];

/**
 * Whether this instance has an assistant at all.
 *
 * `null` until the answer is known, so the editor renders no button rather than one that
 * flickers away. Self-hosted copies without a key never see the feature.
 */
export function useAssistantAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/edit-site")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((j) => { if (live) setAvailable(Boolean(j?.available)); })
      .catch(() => { if (live) setAvailable(false); });
    return () => { live = false; };
  }, []);
  return available;
}

export function AssistantBar({
  sections,
  onApply,
  onClose,
}: {
  sections: Section[];
  onApply: (next: Section[]) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = useCallback(async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/edit-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, instruction: text }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "The rewrite did not go through.");
        return;
      }
      // The response is validated here as well as on the server. The editor writes
      // whatever it is given straight into the document and then into an export, and a
      // proxy, an extension or a stale deploy can all sit between the two.
      const parsed = sectionsSchema.safeParse(json?.sections);
      if (!parsed.success || parsed.data.length !== sections.length) {
        toast.error("That rewrite came back malformed, so nothing changed.");
        return;
      }
      onApply(parsed.data);
      setInstruction("");
      toast.success("Copy rewritten. Undo puts it back.");
    } catch {
      toast.error("Could not reach the assistant.");
    } finally {
      setBusy(false);
    }
  }, [busy, instruction, onApply, sections]);

  const over = instruction.length > MAX_INSTRUCTION_CHARS;

  return (
    <div className="border-b border-white/5 bg-card/40 px-4 py-3">
      <div className="flex items-start gap-2">
        <Textarea
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); }
            if (e.key === "Escape") onClose();
          }}
          rows={2}
          aria-label="Describe the change you want"
          placeholder="Describe the change, such as: rewrite the whole site for a yoga studio in Pune"
          className="flex-1 min-h-0 resize-none bg-white/5 border-white/10 text-sm"
        />
        <div className="flex flex-col gap-1">
          <Button
            onClick={run}
            disabled={busy || !instruction.trim() || over}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white h-8 px-3 text-xs font-semibold"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            Rewrite
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            aria-label="Close the assistant"
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            <X className="w-3 h-3 mr-1" /> Close
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => setInstruction(s)}
            className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-white/25 transition-colors disabled:opacity-40"
          >
            {s}
          </button>
        ))}
        <span className={`ml-auto text-[11px] tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {instruction.length}/{MAX_INSTRUCTION_CHARS}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        It rewrites the words only. Layout, colours, images and button links are left as
        you set them, and the instruction is sent to the assistant to do it.
      </p>
    </div>
  );
}
