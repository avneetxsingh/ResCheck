// Deterministic ATS-style keyword matching. The AI extracts skill NAMES from
// the JD; whether each one appears in the resume is decided here, in code,
// the way a real ATS decides it.
import type { Skill, SkillEvidence } from "@/types/analysis";
import type { StructuredResume } from "./ats-extract";
import type { RoleBlock } from "./work-history";
import { computeWorkHistoryMetrics } from "./work-history";

export interface BuildSkillsOptions {
  structured?: StructuredResume;
  roles?: RoleBlock[];
  now?: Date;
}

const RECENT_MONTHS = 24;
const SUBSTANTIAL_MONTHS = 12;

// Keep + # . so "c++", "c#", "node.js" survive normalization.
export function normalizeSkill(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Degree requirements: the JD-side form comes from the AI ("Bachelor's degree"),
// the resume-side forms are how people actually write them. Levels are ordered
// so Gate 2 can decide "equal or higher" — they are the alias table and the
// degree ladder at once, so the two can never drift apart.
export const DEGREE_GROUPS: { level: number; aliases: string[]; ambiguous: string[] }[] = [
  {
    level: 1,
    aliases: ["bachelor s degree", "bachelors degree", "bachelor s", "bachelor", "b.s.", "b.a.", "bsc", "undergraduate degree"],
    // Someone can write these without holding the degree ("Bachelor's Program
    // coordinator"), so Gate 2 treats a match on them as unproven, not absent.
    ambiguous: ["bachelor s", "bachelor"],
  },
  {
    level: 2,
    aliases: ["master s degree", "masters degree", "master s", "masters", "m.s.", "msc"],
    ambiguous: ["master s", "masters"],
  },
  { level: 3, aliases: ["phd", "ph.d.", "ph.d", "doctorate", "doctoral degree"], ambiguous: [] },
];

const ALIAS_GROUPS: string[][] = [
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["react", "reactjs", "react.js"],
  ["node", "nodejs", "node.js"],
  ["kubernetes", "k8s"],
  ["postgresql", "postgres"],
  ["amazon web services", "aws"],
  ["google cloud platform", "google cloud", "gcp"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["continuous integration", "ci cd", "cicd", "ci"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["next.js", "nextjs", "next js"],
  ...DEGREE_GROUPS.map((g) => g.aliases),
];

function aliasesFor(norm: string): string[] {
  for (const group of ALIAS_GROUPS) {
    if (group.includes(norm)) return group.filter((a) => a !== norm);
  }
  return [];
}

function containsTerm(haystackNorm: string, term: string): boolean {
  if (!term) return false;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(haystackNorm);
}

// One predicate for "does this text mention this skill", shared by the
// top-level match and by evidence gathering. Filtering evidence on the literal
// term alone rated every alias and all-word match as unbacked.
export function skillAppearsIn(haystackNorm: string, norm: string): boolean {
  if (containsTerm(haystackNorm, norm)) return true;
  if (aliasesFor(norm).some((a) => containsTerm(haystackNorm, a))) return true;
  const hit = (w: string) =>
    containsTerm(haystackNorm, w) ||
    containsTerm(haystackNorm, w + "s") ||
    (w.endsWith("s") && containsTerm(haystackNorm, w.slice(0, -1)));
  const words = norm.split(" ").filter((w) => w.length > 2);
  return words.length >= 2 && words.every(hit);
}

const SOFT_SKILLS = new Set([
  "communication", "leadership", "teamwork", "collaboration", "problem solving",
  "time management", "adaptability", "critical thinking", "mentoring",
  "stakeholder management", "presentation", "negotiation", "public speaking",
]);

const TOOLS = new Set([
  "git", "github", "gitlab", "jira", "confluence", "docker", "figma", "postman",
  "excel", "tableau", "power bi", "slack", "jenkins", "terraform", "webpack", "vite",
]);

function classifySkill(norm: string): Skill["category"] {
  if (SOFT_SKILLS.has(norm)) return "soft";
  if (TOOLS.has(norm)) return "tool";
  return "technical";
}

export function buildSkills(
  names: string[],
  resumeText: string,
  opts: BuildSkillsOptions = {}
): Skill[] {
  const resumeNorm = normalizeSkill(resumeText);
  const seen = new Set<string>();
  const skills: Skill[] = [];

  for (const name of names) {
    const norm = normalizeSkill(name);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    let present = false;
    let legacyStrength: Skill["match_strength"] = "missing";

    if (containsTerm(resumeNorm, norm)) {
      present = true;
      legacyStrength = "exact";
    } else if (aliasesFor(norm).some((a) => containsTerm(resumeNorm, a))) {
      present = true; // a clear equivalent appears — ATS counts it, at reduced weight
      legacyStrength = "partial";
    } else {
      // Every significant word must appear. Half-word matching scored
      // "Machine Learning" against a resume that only said "learning".
      const wordHit = (w: string) =>
        containsTerm(resumeNorm, w) ||
        containsTerm(resumeNorm, w + "s") ||
        (w.endsWith("s") && containsTerm(resumeNorm, w.slice(0, -1)));
      const words = norm.split(" ").filter((w) => w.length > 2);
      if (words.length >= 2 && words.every(wordHit)) {
        // Every word of the skill is in the resume, so it IS present. Leaving
        // this false undercounted keyword_density_score, which reads
        // present_in_resume — a skill could rate "strong" and still be
        // tallied as missing.
        present = true;
        legacyStrength = "partial";
      }
    }

    // Evidence is only derivable when role blocks were supplied. Without them
    // the result keeps its pre-existing shape, so old call sites are unaffected.
    let evidence: SkillEvidence | null | undefined;
    let strength: Skill["strength"] | undefined;
    let lastUsed: number | null | undefined;
    let totalMonths: number | null | undefined;

    const haveRoles = Boolean(opts.roles && opts.roles.length > 0);
    if (haveRoles && opts.roles) {
      if (legacyStrength === "missing") {
        evidence = null;
        strength = "missing";
        lastUsed = null;
        totalMonths = null;
      } else {
        const matchedRoles = opts.roles.filter(
          (r) => r.anchored && skillAppearsIn(normalizeSkill(r.text), norm)
        );
        const dated = matchedRoles.filter((r) => r.range.start !== null && r.range.end !== null);
        // Year-only dates are anchored to January, so their recency is a guess.
        // Honour the precision tag rather than rating a guess "strong".
        const monthPrecise = dated.every(
          (r) => r.range.start?.precision !== "year" && r.range.end?.precision !== "year"
        );
        const metrics = computeWorkHistoryMetrics(
          dated.map((r) => r.range),
          opts.now ?? new Date()
        );

        const sections = (opts.structured?.sections ?? [])
          .filter((s) => skillAppearsIn(normalizeSkill(s.lines.join("\n")), norm))
          .map((s) => s.name);

        evidence = {
          kind: containsTerm(resumeNorm, norm) ? "exact" : "alias",
          sections,
          roles: matchedRoles.map((r) => ({
            title: r.title,
            // Duration of this role alone, so the UI can say which role carried
            // the skill longest. computeWorkHistoryMetrics on a single range
            // returns that range's own length.
            // null, not 0, when the dates did not parse — 0 would be
            // indistinguishable from a role that truly lasted no months.
            months:
              r.range.start !== null && r.range.end !== null
                ? computeWorkHistoryMetrics([r.range], opts.now ?? new Date())
                    .total_experience_months
                : null,
            ended_at:
              r.range.end && r.range.end.precision !== "present" && r.range.end.year !== null
                ? String(r.range.end.year)
                : null,
          })),
        };
        lastUsed = matchedRoles.length > 0 ? metrics.last_used_months_ago : null;
        totalMonths = matchedRoles.length > 0 ? metrics.total_experience_months : null;

        if (matchedRoles.length === 0) {
          strength = "weak"; // claimed in a list; nothing dated backs it
        } else if (dated.length === 0) {
          strength = "moderate"; // in a role, but recency is unverifiable
        } else if (
          monthPrecise &&
          metrics.last_used_months_ago !== null &&
          metrics.last_used_months_ago <= RECENT_MONTHS &&
          metrics.total_experience_months >= SUBSTANTIAL_MONTHS
        ) {
          strength = "strong";
        } else {
          strength = "moderate";
        }
      }
    }

    skills.push({
      name: name.trim(),
      present_in_resume: present,
      category: classifySkill(norm),
      match_strength: legacyStrength,
      ...(haveRoles
        ? { strength, evidence, last_used_months_ago: lastUsed, total_months: totalMonths }
        : {}),
    });
  }
  return skills;
}

// A long posting's requirements usually sit after the company blurb, so blind
// head-truncation cuts exactly the part that matters. Keep the head (title,
// role framing) plus the window starting at the first requirements-style
// heading found past it.
const REQUIREMENTS_MARKER =
  /(requirements?|qualifications?|must[- ]haves?|what you('|’)ll need|who you are|skills)\b/i;

export function clipJd(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const headLen = Math.floor(budget * 0.3);
  const tailLen = budget - headLen;
  const head = text.slice(0, headLen);
  const rest = text.slice(headLen);
  const markerIdx = rest.match(REQUIREMENTS_MARKER)?.index;
  const start = markerIdx !== undefined ? markerIdx : Math.max(0, rest.length - tailLen);
  return `${head}\n…\n${rest.slice(start, start + tailLen)}`;
}

export function extractBonusSkills(structured: StructuredResume, jdSkillNames: string[]): string[] {
  const skillsSection = structured.sections.find((s) => s.name === "skills");
  if (!skillsSection) return [];

  const jdNorms = new Set(jdSkillNames.map(normalizeSkill));
  const seen = new Set<string>();
  const bonus: string[] = [];

  const tokens = skillsSection.lines
    .flatMap((l) =>
      l.replace(/^[•\-*–▪·]\s*/, "").replace(/^[A-Za-z &/]+:\s*/, "").split(/[,|;•]+/)
    )
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 40);

  for (const t of tokens) {
    const n = normalizeSkill(t);
    if (!n || jdNorms.has(n) || seen.has(n)) continue;
    seen.add(n);
    bonus.push(t);
  }
  return bonus.slice(0, 12);
}

// The prompt asks for 1-4 word skills, but a prompt is a request. Whole JD
// sentences arriving as "skills" match nothing and depress the score, so the
// guard lives here. Normalize first: stripping a stock prefix salvages a real
// skill that would otherwise be discarded.
const SKILL_PREFIXES =
  /^(?:\d+\+?\s*years?\s+(?:of\s+)?(?:experience\s+(?:with|in)\s+)?|experience\s+(?:with|in|using)\s+|knowledge\s+of\s+|proficiency\s+(?:in|with)\s+|familiarity\s+with\s+|understanding\s+of\s+|demonstrated\s+|proven\s+|strong\s+|excellent\s+|expert(?:-level)?\s+|advanced\s+)/i;

const ABSTRACT_HEAD =
  /^(?:experience|ability|abilities|knowledge|understanding|familiarity|proficiency|skills?|expertise|background|track record|passion|desire)\b/i;

export function sanitizeSkillName(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  // Sentence punctuation means this is prose or a list, not one skill. A period
  // only reads as sentence punctuation when whitespace follows it: "Node.js",
  // ".NET" and "Ph.D." are real skills, and both normalizeSkill and
  // ALIAS_GROUPS depend on them surviving this guard.
  if (/[;:!?]/.test(s) || /\.\s/.test(s)) return null;

  let previous = "";
  while (s !== previous) {
    previous = s;
    s = s.replace(SKILL_PREFIXES, "").trim();
  }
  if (!s) return null;

  // Real skills top out around "Amazon Web Services" (3 words). Phrases with 4+ words
  // are reliably abstract lists or compound descriptions, not atomic skills.
  if (s.split(/\s+/).length > 3) return null;
  if (ABSTRACT_HEAD.test(s)) return null;

  return s;
}

const NEGATORS = /\b(no|not|without|neither|nor)\b/i;

export function isNegatedInJd(skill: string, jdText: string): boolean {
  const norm = normalizeSkill(skill);
  if (!norm) return false;
  // Commas separate clauses too ("No Java required, Python is essential"), and
  // one affirmative mention outranks a negated one — a skill counts as negated
  // only when EVERY occurrence is negated. Dropping a requirement the candidate
  // really needs is the costly direction of error.
  let sawOccurrence = false;
  for (const clause of jdText.split(/[.,;!?\n]+/)) {
    const clauseNorm = normalizeSkill(clause);
    // Locate the word-boundary occurrence, not a raw substring: indexOf("java")
    // lands inside "javascript" and misreads the negator scope.
    const esc = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hit = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).exec(clauseNorm);
    if (!hit) continue;
    sawOccurrence = true;
    const before = clauseNorm.slice(0, hit.index);
    if (!NEGATORS.test(before)) return false;
  }
  return sawOccurrence;
}
