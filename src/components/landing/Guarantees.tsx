import { Reveal } from "@/components/motion/Reveal";
import { GUARANTEES } from "@/lib/offer";

// Two guarantees, both outcome-free on purpose. Competitors guarantee
// interviews and cannot deliver them; these are the two this codebase already
// keeps, which is the only kind worth printing.
export function Guarantees() {
  return (
    <section className="py-16 border-t border-border">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">Two guarantees</h2>
      </Reveal>
      <div className="mt-8 flex flex-col gap-7">
        {GUARANTEES.map((g, i) => (
          <Reveal key={g.name} delay={60 + i * 60}>
            <div className="border-l-2 border-primary pl-5">
              <h3 className="text-lg font-medium tracking-tight">{g.name}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-prose">
                {g.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
