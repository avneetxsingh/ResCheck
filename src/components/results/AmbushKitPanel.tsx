"use client";

import { Reveal } from "@/components/motion/Reveal";
import type { AmbushKit } from "@/types/analysis";

interface AmbushKitPanelProps {
  /** Optional: history entries written before Phase 4 do not carry it. */
  kit?: AmbushKit;
}

// Questions in sans, evidence in mono — mono carries data, sans carries prose.
// Nothing here asserts that a question WILL be asked; each evidence line is a
// value computed from the document.
export function AmbushKitPanel({ kit }: AmbushKitPanelProps) {
  if (!kit) {
    return (
      <p className="text-sm text-muted-foreground">
        This analysis ran before the Ambush Kit existed, so no questions were derived for it.
      </p>
    );
  }

  if (kit.questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {kit.dates_unreadable
          ? "We couldn't read the dates on your roles, so gaps and tenure went unchecked. That isn't a clean bill — it's an unread one."
          : "Nothing in this résumé invites an obvious question."}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-5">
      {kit.questions.map((q, i) => (
        <Reveal key={`${q.key}-${q.question}`} delay={i * 40}>
          <li className="border-l-2 border-border pl-4">
            <p className="text-sm leading-relaxed">{q.question}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {q.evidence.map((e) => (
                <li key={e} className="font-mono text-xs text-muted-foreground">
                  {e}
                </li>
              ))}
            </ul>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}
