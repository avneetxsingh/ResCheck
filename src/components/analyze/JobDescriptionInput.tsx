"use client";

import { Textarea } from "@/components/ui/textarea";

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

// The hint is one slot that swaps its sentence, never a stack that appears and
// disappears — a box that changes height while you type is the thing this
// screen was rebuilt to stop doing.
function densityHint(wordCount: number): string | null {
  if (wordCount === 0) return null;
  if (wordCount < 30) return "short posting — keyword matching will be thin, the writing audit still runs";
  if (wordCount < 80) return "more detail here means better skill matching";
  return null;
}

export function JobDescriptionInput({ value, onChange }: JobDescriptionInputProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const hint = densityHint(wordCount);

  return (
    <div className="space-y-2">
      {/* The composer card already carries a visible "Job description" heading,
          so this stays for screen readers rather than printing it twice. */}
      <label htmlFor="jd-input" className="sr-only">
        Job description
      </label>
      <Textarea
        id="jd-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full posting — requirements, responsibilities, all of it."
        // field-sizing-fixed overrides the shared primitive's grow-with-content
        // default. Height is the reader's to change via resize-y, never the
        // content's to take.
        className="field-sizing-fixed h-52 resize-y text-sm transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-settle)]"
      />
      {/* Fixed height: the sentence swapping underneath must never shift the
          button below it. */}
      <div className="flex h-4 items-baseline justify-between gap-3">
        <span
          className="text-xs text-state-warn transition-opacity duration-[var(--dur-base)] ease-[var(--ease-settle)]"
          style={{ opacity: hint ? 1 : 0 }}
        >
          {hint ?? ""}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  );
}
