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

  // Kept as one string in both branches: a reader who sees questions must not be
  // left thinking gaps and tenure were checked and came back clean.
  const DATES_UNREADABLE =
    "We couldn't read the dates on your roles, so gaps and tenure went unchecked.";

  if (kit.questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {kit.dates_unreadable
          ? `${DATES_UNREADABLE} That isn't a clean bill — it's an unread one.`
          : "Nothing in this résumé invites an obvious question."}
      </p>
    );
  }

  return (
    <>
      {kit.dates_unreadable && (
        <p className="mb-4 text-sm text-muted-foreground">
          {DATES_UNREADABLE} The questions below come from what we could read.
        </p>
      )}
      <ol className="flex flex-col gap-5">
        {kit.questions.map((q, i) => (
          // Reveal renders a <div>, so it sits INSIDE the <li> rather than around
          // it: a wrapper between <ol> and <li> stops screen readers announcing
          // this as a list.
          <li key={`${q.key}-${i}`} className="border-l-2 border-border pl-4">
            <Reveal delay={i * 40}>
              <p className="text-sm leading-relaxed">{q.question}</p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {q.evidence.map((e, j) => (
                  <li key={`${j}-${e}`} className="font-mono text-xs text-muted-foreground">
                    {e}
                  </li>
                ))}
              </ul>
            </Reveal>
          </li>
        ))}
      </ol>
    </>
  );
}
