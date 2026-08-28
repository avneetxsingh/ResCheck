import { Reveal } from "@/components/motion/Reveal";

interface SampleRow {
  label: string;
  value: string;
  tone: "pass" | "warn" | "fail";
}

// Illustrative, and labelled as such. A sample that reads as the visitor's own
// result would be the page telling them something about a document it has
// never seen.
const SAMPLE: SampleRow[] = [
  { label: "Contact details found", value: "email · phone · GitHub", tone: "pass" },
  { label: "Sections detected", value: "Experience · Skills", tone: "pass" },
  { label: "Education heading", value: "not detected", tone: "fail" },
  { label: "Must-haves matched", value: "2 of 5", tone: "warn" },
];

const TONE: Record<SampleRow["tone"], string> = {
  pass: "text-state-pass",
  warn: "text-state-warn",
  fail: "text-state-fail",
};

export function FirstScreenSample() {
  return (
    <section className="py-16 border-t border-border">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">The First Screen</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          What a parser pulls out of your document before a person reads a word of it — which
          sections it found, which contact details survived, and which of the posting&apos;s
          must-haves it could match.
        </p>
      </Reveal>
      <Reveal delay={80}>
        <figure className="mt-8 rounded-xl border border-border bg-card px-5 py-4">
          <figcaption className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Example output — not your résumé
          </figcaption>
          <dl className="mt-3">
            {SAMPLE.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border/60 last:border-b-0"
              >
                <dt className="text-sm">{row.label}</dt>
                <dd className={`font-mono text-sm ${TONE[row.tone]}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </Reveal>
    </section>
  );
}
