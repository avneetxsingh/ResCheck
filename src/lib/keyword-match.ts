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
      // Word-level fallback with simple plural tolerance ("API" matches "APIs")
      const wordHit = (w: string) =>
        containsTerm(resumeNorm, w) ||
        containsTerm(resumeNorm, w + "s") ||
        (w.endsWith("s") && containsTerm(resumeNorm, w.slice(0, -1)));
      const words = norm.split(" ").filter((w) => w.length > 2);
      if (words.length >= 2) {
        const hits = words.filter(wordHit).length;
        if (hits >= Math.ceil(words.length / 2)) strength = "partial";
      }
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
