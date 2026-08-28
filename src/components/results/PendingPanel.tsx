"use client";

interface PendingPanelProps {
  title: string;
  /** How many placeholder rows to draw. Match the panel's typical density. */
  lines?: number;
}

// A designed intermediate, not a spinner. It occupies roughly the space the
// real panel will, so nothing jumps when the content lands, and it names what
// is still being worked on rather than implying the page is stuck.
export function PendingPanel({ title, lines = 3 }: PendingPanelProps) {
  return (
    <section className="rounded-xl border border-border/60 px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-medium tracking-tight text-muted-foreground">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground">reading…</span>
      </div>
      <div className="mt-3 space-y-2.5" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-muted animate-pulse"
            style={{ width: `${88 - i * 14}%`, animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">Still analysing {title.toLowerCase()}.</span>
    </section>
  );
}
