import { FileSearch, ScanText, PenLine, Building2, MessageCircleQuestion } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { OFFER_ITEMS } from "@/lib/offer";
import { cn } from "@/lib/utils";

// Keyed by slot so an item cannot silently lose its icon when copy changes.
const ICONS: Record<string, typeof FileSearch> = {
  Main: FileSearch,
  "Bonus A": ScanText,
  "Bonus B": PenLine,
  "Bonus C": Building2,
  "Bonus D": MessageCircleQuestion,
};

export function ValueStack() {
  const pending = OFFER_ITEMS.filter((item) => !item.available).length;

  return (
    <section id="what-you-get" className="scroll-mt-8 border-t border-border py-16">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">Everything the report tells you</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Each is computed from your document and the posting you paste — none of them is a
          model&apos;s opinion of you.
          {pending > 0 &&
            ` ${pending === 1 ? "One is" : `${pending} are`} still being built, and marked below.`}
        </p>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OFFER_ITEMS.map((item, i) => (
          <Reveal key={item.name} delay={60 + i * 40}>
            <article
              className={cn(
                "h-full rounded-xl border bg-card px-5 py-5",
                item.slot === "Main" ? "border-primary/35" : "border-border",
                // An unbuilt item must not look as solid as a built one.
                !item.available && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                  {(() => {
                    const Icon = ICONS[item.slot] ?? FileSearch;
                    return <Icon className="h-4 w-4 text-accent-foreground" aria-hidden />;
                  })()}
                </span>
                {!item.available && (
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Coming next
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-base font-medium tracking-tight">{item.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.blurb}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
