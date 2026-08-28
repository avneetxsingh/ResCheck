// The questions a résumé invites, each carrying the computed facts that raised
// it. Pure and synchronous: no AI call, no I/O. The question strings are owned
// by this file and selected by trigger — the model is never asked what to ask,
// because a model-authored question would be exactly the invented judgement
// this product removed everywhere else.
import { monthsLabel, STALE_MONTHS } from "./funnel";
import { formatParsedDate, type EmploymentGap, type WorkHistoryMetrics } from "./work-history";
import type { AmbushKit, AmbushQuestion, AmbushTrigger, KnockoutGate, Skill } from "@/types/analysis";

const SHORT_TENURE_MONTHS = 18;

const MAX_QUESTIONS = 6;
const MAX_GAPS = 3;
const MAX_UNEVIDENCED = 3;
const MAX_STALE = 2;
const MAX_KNOCKOUT = 2;

// Ordered by what the item costs the candidate, matching the results column.
// The cap is applied AFTER this ordering, so the most expensive questions
// always survive it.
const TRIGGER_ORDER: AmbushTrigger[] = [
  "failed_knockout",
  "employment_gap",
  "unevidenced_skill",
  "short_tenure",
  "stale_skill",
];

export interface AmbushKitInput {
  gaps: EmploymentGap[];
  mustHave: Skill[];
  knockout: KnockoutGate;
  metrics: WorkHistoryMetrics;
}

function knockoutQuestions(knockout: KnockoutGate): AmbushQuestion[] {
  if (!knockout.stated) return [];
  return knockout.checks
    .filter((c) => c.required && c.verdict === "fail")
    .slice(0, MAX_KNOCKOUT)
    .map((c) => ({
      key: "failed_knockout" as const,
      question:
        c.type === "years_experience"
          ? `You're under the stated ${c.value}-year bar. Why should they make an exception?`
          : `The posting requires ${c.value}. How do you meet it?`,
      evidence: [`Stated requirement: ${c.value}`, c.detail],
    }));
}

function gapQuestions(gaps: EmploymentGap[]): AmbushQuestion[] {
  return [...gaps]
    .sort((a, b) => b.months - a.months)
    .slice(0, MAX_GAPS)
    .map((g) => ({
      key: "employment_gap" as const,
      question: `Walk me through the ${monthsLabel(g.months)} between ${g.role_before} and ${g.role_after}.`,
      evidence: [
        `${g.role_before} ended ${formatParsedDate(g.ended_at)}`,
        `${g.role_after} began ${formatParsedDate(g.resumed_at)}`,
      ],
    }));
}

function unevidencedQuestions(mustHave: Skill[]): AmbushQuestion[] {
  return mustHave
    .filter((s) => s.strength === "weak")
    .slice(0, MAX_UNEVIDENCED)
    .map((s) => ({
      key: "unevidenced_skill" as const,
      question: `You list ${s.name}, but no dated role shows it. Where did you use it?`,
      evidence: [`${s.name} appears in your résumé`, "No dated role evidences it"],
    }));
}

function tenureQuestions(metrics: WorkHistoryMetrics): AmbushQuestion[] {
  const avg = metrics.avg_tenure_months;
  if (avg === null || avg >= SHORT_TENURE_MONTHS) return [];
  return [
    {
      key: "short_tenure",
      question: `Your roles average ${monthsLabel(avg)}. Why the short stints?`,
      evidence: [`Average time per role: ${monthsLabel(avg)}`],
    },
  ];
}

function staleQuestions(mustHave: Skill[], alreadyAsked: Set<string>): AmbushQuestion[] {
  return mustHave
    .flatMap((s): AmbushQuestion[] => {
      const ago = s.last_used_months_ago;
      if (typeof ago !== "number" || ago <= STALE_MONTHS) return [];
      // One skill must not generate two questions; the unevidenced question is
      // the stronger of the two and has already been asked. Currently
      // unreachable in production: keyword-match.ts sets strength "weak" only
      // when a skill has no matched roles, and that same branch forces
      // last_used_months_ago to null, so a "weak" skill can never also be
      // "stale". Kept as a defensive guard in case that coupling changes.
      if (alreadyAsked.has(s.name)) return [];
      return [
        {
          key: "stale_skill",
          question: `You list ${s.name}, but the last role using it ended ${monthsLabel(ago)} ago. How current are you?`,
          evidence: [`${s.name} last evidenced ${monthsLabel(ago)} ago`],
        },
      ];
    })
    .slice(0, MAX_STALE);
}

export function buildAmbushKit(input: AmbushKitInput): AmbushKit {
  const { gaps, mustHave, knockout, metrics } = input;

  const unevidenced = unevidencedQuestions(mustHave);
  // Deduplicate against the questions actually produced, not against every weak
  // skill. A weak skill that fell outside MAX_UNEVIDENCED has no question yet,
  // so suppressing its stale question too would drop it from the kit entirely.
  const askedSkills = new Set(
    mustHave
      .filter((s) => s.strength === "weak")
      .slice(0, MAX_UNEVIDENCED)
      .map((s) => s.name)
  );

  // The concatenation below is already written in TRIGGER_ORDER order, so this
  // sort is currently a no-op. Kept so ordering stays correct if that
  // concatenation order is ever edited without updating TRIGGER_ORDER too.
  const questions = [
    ...knockoutQuestions(knockout),
    ...gapQuestions(gaps),
    ...unevidenced,
    ...tenureQuestions(metrics),
    ...staleQuestions(mustHave, askedSkills),
  ].sort((a, b) => TRIGGER_ORDER.indexOf(a.key) - TRIGGER_ORDER.indexOf(b.key));

  return {
    questions: questions.slice(0, MAX_QUESTIONS),
    // avg_tenure_months is null exactly when no role span parsed, which is the
    // one case where an empty question list means "unread", not "clean".
    dates_unreadable: metrics.avg_tenure_months === null,
  };
}
