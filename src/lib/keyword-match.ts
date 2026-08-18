// Deterministic ATS-style keyword matching. The AI extracts skill NAMES from
// the JD; whether each one appears in the resume is decided here, in code,
// the way a real ATS decides it.
import type { Skill } from "@/types/analysis";
import type { StructuredResume } from "./ats-extract";

// Keep + # . so "c++", "c#", "node.js" survive normalization.
export function normalizeSkill(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  // Degree requirements: the JD-side form comes from the AI ("Bachelor's degree"),
  // the resume-side forms are how people actually write them.
  ["bachelor s degree", "bachelors degree", "bachelor s", "bachelor", "b.s.", "b.a.", "bsc", "undergraduate degree"],
  ["master s degree", "masters degree", "master s", "masters", "m.s.", "msc"],
  ["phd", "ph.d.", "ph.d", "doctorate", "doctoral degree"],
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

export function buildSkills(names: string[], resumeText: string): Skill[] {
  const resumeNorm = normalizeSkill(resumeText);
  const seen = new Set<string>();
  const skills: Skill[] = [];

  for (const name of names) {
    const norm = normalizeSkill(name);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    let present = false;
    let strength: Skill["match_strength"] = "missing";

    if (containsTerm(resumeNorm, norm)) {
      present = true;
      strength = "exact";
    } else if (aliasesFor(norm).some((a) => containsTerm(resumeNorm, a))) {
      present = true; // a clear equivalent appears — ATS counts it, at reduced weight
      strength = "partial";
    } else {
      // Every significant word must appear. Half-word matching scored
      // "Machine Learning" against a resume that only said "learning".
      const wordHit = (w: string) =>
        containsTerm(resumeNorm, w) ||
        containsTerm(resumeNorm, w + "s") ||
        (w.endsWith("s") && containsTerm(resumeNorm, w.slice(0, -1)));
      const words = norm.split(" ").filter((w) => w.length > 2);
      if (words.length >= 2 && words.every(wordHit)) strength = "partial";
    }

    skills.push({
      name: name.trim(),
      present_in_resume: present,
      category: classifySkill(norm),
      match_strength: strength,
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

  // Sentence punctuation means this is prose or a list, not one skill.
  if (/[.;:!?]/.test(s)) return null;

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
    if (!containsTerm(clauseNorm, norm)) continue;
    sawOccurrence = true;
    const before = clauseNorm.slice(0, clauseNorm.indexOf(norm));
    if (!NEGATORS.test(before)) return false;
  }
  return sawOccurrence;
}
