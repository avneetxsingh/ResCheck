import { describe, it, expect } from "vitest";
import { buildAmbushKit } from "../ambush-kit";
import type { EmploymentGap, WorkHistoryMetrics } from "../work-history";
import type { KnockoutGate, Skill } from "@/types/analysis";

const NO_KNOCKOUT: KnockoutGate = { verdict: "pass", stated: false, checks: [] };

const METRICS = (over: Partial<WorkHistoryMetrics> = {}): WorkHistoryMetrics => ({
  total_experience_months: 60,
  last_used_months_ago: 1,
  avg_tenure_months: 30,
  gap_months: [],
  ...over,
});

const SKILL = (over: Partial<Skill> = {}): Skill => ({
  name: "Kubernetes",
  present_in_resume: true,
  category: "technical",
  match_strength: "exact",
  ...over,
});

const GAP: EmploymentGap = {
  months: 8,
  role_before: "Acme",
  role_after: "Globex",
  ended_at: { year: 2023, month: 3, precision: "month" },
  resumed_at: { year: 2023, month: 11, precision: "month" },
};

const base = { gaps: [], mustHave: [], knockout: NO_KNOCKOUT, metrics: METRICS() };

describe("buildAmbushKit — triggers", () => {
  it("asks about a gap, naming both roles and both dates", () => {
    const kit = buildAmbushKit({ ...base, gaps: [GAP] });
    expect(kit.questions).toHaveLength(1);
    expect(kit.questions[0].key).toBe("employment_gap");
    expect(kit.questions[0].question).toBe(
      "Walk me through the 8 months between Acme and Globex."
    );
    expect(kit.questions[0].evidence).toEqual([
      "Acme ended Mar 2023",
      "Globex began Nov 2023",
    ]);
  });

  it("asks about a skill listed with no dated role behind it", () => {
    const kit = buildAmbushKit({ ...base, mustHave: [SKILL({ strength: "weak" })] });
    expect(kit.questions[0].key).toBe("unevidenced_skill");
    expect(kit.questions[0].question).toContain("Kubernetes");
    expect(kit.questions[0].evidence).toContain("No dated role evidences it");
  });

  it("asks about short tenure only when it is actually short", () => {
    expect(buildAmbushKit({ ...base, metrics: METRICS({ avg_tenure_months: 30 }) }).questions)
      .toEqual([]);
    const short = buildAmbushKit({ ...base, metrics: METRICS({ avg_tenure_months: 11 }) });
    expect(short.questions[0].key).toBe("short_tenure");
    expect(short.questions[0].question).toContain("11 months");
  });

  it("asks about a stale required skill", () => {
    const kit = buildAmbushKit({
      ...base,
      mustHave: [SKILL({ strength: "strong", last_used_months_ago: 40 })],
    });
    expect(kit.questions[0].key).toBe("stale_skill");
  });

  it("does not ask twice about one skill that is both unevidenced and stale", () => {
    const kit = buildAmbushKit({
      ...base,
      mustHave: [SKILL({ strength: "weak", last_used_months_ago: 40 })],
    });
    expect(kit.questions).toHaveLength(1);
    expect(kit.questions[0].key).toBe("unevidenced_skill");
  });

  it("asks about a failed required knockout, and ignores a preferred one", () => {
    const knockout: KnockoutGate = {
      verdict: "fail",
      stated: true,
      checks: [
        { type: "years_experience", value: "8", required: true, verdict: "fail", detail: "Resume shows 5 years." },
        { type: "certification", value: "PMP", required: false, verdict: "fail", detail: "Not found." },
      ],
    };
    const kit = buildAmbushKit({ ...base, knockout });
    expect(kit.questions).toHaveLength(1);
    expect(kit.questions[0].key).toBe("failed_knockout");
    expect(kit.questions[0].question).toContain("8-year");
  });
});

describe("buildAmbushKit — ordering and volume", () => {
  it("puts the most expensive question first", () => {
    const knockout: KnockoutGate = {
      verdict: "fail",
      stated: true,
      checks: [{ type: "years_experience", value: "8", required: true, verdict: "fail", detail: "Resume shows 5 years." }],
    };
    const kit = buildAmbushKit({
      ...base,
      knockout,
      gaps: [GAP],
      mustHave: [SKILL({ strength: "weak" })],
      metrics: METRICS({ avg_tenure_months: 11 }),
    });
    expect(kit.questions.map((q) => q.key)).toEqual([
      "failed_knockout", "employment_gap", "unevidenced_skill", "short_tenure",
    ]);
  });

  it("caps the list, keeping the most expensive questions", () => {
    const gaps = Array.from({ length: 5 }, (_, i) => ({ ...GAP, months: 7 + i }));
    const mustHave = ["A", "B", "C", "D"].map((n) => SKILL({ name: n, strength: "weak" }));
    const kit = buildAmbushKit({ ...base, gaps, mustHave });
    expect(kit.questions.length).toBeLessThanOrEqual(6);
    expect(kit.questions[0].key).toBe("employment_gap");
    // Longest gap survives the cap. 11 rather than 12 on purpose: monthsLabel
    // rolls 12 over to "1 year", which would make this assert the formatter's
    // rollover rule instead of the cap's ordering.
    expect(kit.questions[0].question).toContain("11 months");
  });

  it("still asks about a stale skill whose unevidenced question was capped out", () => {
    // Four weak skills: only three get an unevidenced question. The fourth is
    // also stale, so it must surface as a stale question rather than vanish.
    const mustHave = [
      SKILL({ name: "A", strength: "weak" }),
      SKILL({ name: "B", strength: "weak" }),
      SKILL({ name: "C", strength: "weak" }),
      SKILL({ name: "D", strength: "weak", last_used_months_ago: 40 }),
    ];
    const kit = buildAmbushKit({ ...base, mustHave });
    const named = kit.questions.filter((q) => q.question.includes("D"));
    expect(named).toHaveLength(1);
    expect(named[0].key).toBe("stale_skill");
  });
});

describe("buildAmbushKit — the two empty states are different states", () => {
  it("reports nothing to ask when the triggers ran and none fired", () => {
    const kit = buildAmbushKit(base);
    expect(kit.questions).toEqual([]);
    expect(kit.dates_unreadable).toBe(false);
  });

  it("reports unreadable dates rather than a clean bill", () => {
    const kit = buildAmbushKit({ ...base, metrics: METRICS({ avg_tenure_months: null }) });
    expect(kit.questions).toEqual([]);
    expect(kit.dates_unreadable).toBe(true);
  });
});

describe("buildAmbushKit — every count has a singular branch", () => {
  it("says '1 month', not '1 months'", () => {
    const kit = buildAmbushKit({ ...base, gaps: [{ ...GAP, months: 1 }] });
    expect(kit.questions[0].question).toContain("1 month ");
    expect(kit.questions[0].question).not.toContain("1 months");
  });

  it("renders a twelve-month gap as a year, not as twelve months", () => {
    const kit = buildAmbushKit({ ...base, gaps: [{ ...GAP, months: 12 }] });
    expect(kit.questions[0].question).toContain("1 year");
    expect(kit.questions[0].question).not.toContain("12 months");
  });
});
