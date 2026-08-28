import { Reveal } from "@/components/motion/Reveal";
import { OFFER_ITEMS } from "@/lib/offer";
import { cn } from "@/lib/utils";

export function ValueStack() {
  return (
    <section className="py-16 border-t border-border">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">What you get</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Every one of these is computed from your document. None of them is a model&apos;s
          opinion of you.
        </p>
      </Reveal>
      <div className="mt-8 flex flex-col gap-3">
        {OFFER_ITEMS.map((item, i) => (
          <Reveal key={item.name} delay={60 + i * 40}>
            <article
              className={cn(
                "rounded-xl border px-5 py-4 bg-card",
                item.slot === "Main" ? "border-primary/35" : "border-border"
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.slot}
              </div>
              <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
                <h3 className="text-lg font-medium tracking-tight">{item.name}</h3>
                {!item.available && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    Coming next
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-prose">
                {item.blurb}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
