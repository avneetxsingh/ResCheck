import { Reveal } from "@/components/motion/Reveal";
import { FAQ_ITEMS } from "@/lib/offer";

// Native <details>: no state, no JS, and it opens on the browser's
// find-in-page, which a JS accordion does not.
export function Faq() {
  return (
    <section id="faq" className="scroll-mt-8 border-t border-border py-16">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
      </Reveal>
      <div className="mt-8 max-w-3xl">
        {FAQ_ITEMS.map((item, i) => (
          <Reveal key={item.question} delay={50 + i * 40}>
            <details className="group border-b border-border last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium">
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-lg text-muted-foreground transition-transform duration-[var(--dur-fast)] ease-[var(--ease-settle)] group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
