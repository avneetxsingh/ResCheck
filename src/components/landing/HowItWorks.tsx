import { FileUp, ClipboardPaste, ScanLine } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { MAX_UPLOAD_MB } from "@/lib/upload-limit";

// PDF only, and the size comes from the constant the uploader enforces — the
// reference this was modelled on says "PDF or DOCX", which would be a promise
// the parser cannot keep.
const STEPS = [
  {
    icon: FileUp,
    name: "Add your résumé",
    body: `A PDF up to ${MAX_UPLOAD_MB} MB. It is read once to build your report, and no copy is kept.`,
  },
  {
    icon: ClipboardPaste,
    name: "Paste the posting",
    body: "The whole thing — requirements, responsibilities, the lot. More detail means better matching.",
  },
  {
    icon: ScanLine,
    name: "See what screening does",
    body: "Which gates you clear, which searches surface you, and what a parser silently dropped.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-8 border-t border-border py-16">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
      </Reveal>
      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.name} delay={60 + i * 60}>
            <li className="h-full rounded-xl border border-border bg-card px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <step.icon className="h-4 w-4 text-accent-foreground" aria-hidden />
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-base font-medium tracking-tight">{step.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
