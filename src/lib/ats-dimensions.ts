import type { AnalysisResult } from "@/types/analysis";

/**
 * One spoke of the ATS Dimensions chart.
 *
 * `total` is null when the dimension is not measurable for this run — the
 * posting stated no hard requirements, say, or a stored entry predates section
 * reporting. That is NOT the same as zero, and the chart must not draw it as a
 * vertex at the origin: a résumé that could not be checked would then look
 * identical to one that failed everything. `ratio` is null in exactly that case.
 */
export interface AtsDimension {
  key: string;
  label: string;
  /** How many of `total` this résumé satisfies. Null when not measurable. */
  present: number | null;
  total: number | null;
  /** present / total, or null when not measurable. Never invented. */
  ratio: number | null;
  /** Reads as a sentence beside the axis: "9 of 9 recruiter searches". */
  detail: string;
}

// Both noun forms are passed in rather than suffixed with "s": "search" would
// pluralize to "searchs". Every count-interpolating string in this repo carries
// a singular branch.
function fraction(
  key: string,
  label: string,
  present: number,
  total: number,
  noun: { one: string; many: string },
  unmeasured: string
): AtsDimension {
  if (total <= 0) {
    return { key, label, present: null, total: null, ratio: null, detail: unmeasured };
  }
  return {
    key,
    label,
    present,
    total,
    ratio: present / total,
    detail: `${present} of ${total} ${total === 1 ? noun.one : noun.many}`,
  };
}

/**
 * The five axes are ratios ResCheck actually computes, each carrying its raw
 * counts. None is a percentage the app invented, and they are deliberately
 * never averaged into an overall figure — that number is the one sub-project C
 * deleted, and combining honest ratios would smuggle it back in wearing a chart.
 */
export function buildAtsDimensions(result: AnalysisResult): AtsDimension[] {
  const funnel = result.funnel;
  const skills = result.skills_gap;
  const extraction = result.ats_extraction;

  const mustHave = skills?.must_have ?? [];
  const niceToHave = skills?.nice_to_have ?? [];

  // Only requirements code can actually check. work_authorization and location
  // are always unverifiable — counting them as failures would invent a verdict
  // the app refuses to give, and counting them as passes would invent a
  // clearance it never granted.
  const checkable = (funnel?.knockout.checks ?? []).filter(
    (c) => c.verdict !== "unverifiable"
  );
  const passed = checkable.filter((c) => c.verdict === "pass").length;

  const detected = extraction?.sections_detected.length ?? 0;
  const missing = extraction?.sections_missing?.length ?? 0;

  return [
    fraction(
      "retrieve",
      "Searches",
      funnel?.retrieve.surfaced ?? 0,
      funnel?.retrieve.total ?? 0,
      { one: "recruiter search", many: "recruiter searches" },
      "No searches to run"
    ),
    fraction(
      "must_have",
      "Must-haves",
      mustHave.filter((s) => s.present_in_resume).length,
      mustHave.length,
      { one: "required skill", many: "required skills" },
      "None stated"
    ),
    fraction(
      "requirements",
      "Requirements",
      passed,
      checkable.length,
      { one: "stated requirement", many: "stated requirements" },
      "None checkable"
    ),
    fraction(
      "sections",
      "Sections",
      detected,
      detected + missing,
      { one: "expected section", many: "expected sections" },
      "Not reported"
    ),
    fraction(
      "nice_to_have",
      "Nice-to-haves",
      niceToHave.filter((s) => s.present_in_resume).length,
      niceToHave.length,
      { one: "preferred skill", many: "preferred skills" },
      "None stated"
    ),
  ];
}

/** True when nothing on the chart is measurable, so the caller renders prose. */
export function hasNoMeasurableDimension(dims: AtsDimension[]): boolean {
  return dims.every((d) => d.ratio === null);
}

export interface CheckTally {
  /** Individual checks this résumé satisfied. */
  passed: number;
  /** Individual checks that were actually run. Never includes the unmeasurable. */
  total: number;
  /** Axes that could not be checked at all, named so the figure can say so. */
  unmeasured: string[];
}

/**
 * The headline figure, and the reason it is allowed to exist.
 *
 * This is NOT the `overall_ats_score` deleted in sub-project C. That number was
 * a weighted blend of invented sub-scores; this is a literal count of discrete
 * checks the app ran — one per recruiter search, per required skill, per
 * checkable requirement, per expected section, per preferred skill. Every unit
 * is auditable, and the same counts are listed beside the chart.
 *
 * Two properties keep it from drifting back into a score: an axis that could
 * not be measured is excluded from BOTH sides of the fraction rather than
 * counted as a failure, and its name is carried out so the figure can admit
 * what it left out.
 */
export function summariseChecks(dims: AtsDimension[]): CheckTally {
  let passed = 0;
  let total = 0;
  const unmeasured: string[] = [];
  for (const d of dims) {
    if (d.ratio === null || d.present === null || d.total === null) {
      unmeasured.push(d.label);
      continue;
    }
    passed += d.present;
    total += d.total;
  }
  return { passed, total, unmeasured };
}
