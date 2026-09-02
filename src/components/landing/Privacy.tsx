import { Reveal } from "@/components/motion/Reveal";
import { PRIVACY_FACTS } from "@/lib/offer";

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-8 border-t border-border py-16">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">Your résumé is yours.</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          It is a document about your life, and this app is built so that there is nothing to
          leak.
        </p>
      </Reveal>
      <dl className="mt-8 grid gap-8 sm:grid-cols-3">
        {PRIVACY_FACTS.map((fact, i) => (
          <Reveal key={fact.name} delay={60 + i * 50}>
            <div>
              <dt className="text-sm font-medium tracking-tight">{fact.name}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{fact.body}</dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
