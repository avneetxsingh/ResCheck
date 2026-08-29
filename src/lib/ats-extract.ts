// Deterministic ATS-style resume sectionizer. No AI — what this file reports
// is by construction present in the text.
import { detectMergedColumns } from "./column-detect";
import type {
  ResumeSection,
  AtsContactInfo,
  AtsExtraction,
  ColumnEvidence,
  UnrecognizedHeading,
} from "@/types/analysis";

export interface ResumeSectionBlock {
  name: ResumeSection;
  heading: string; // verbatim heading line; "" for the contact preamble
  lines: string[]; // non-empty lines, trailing whitespace preserved for audit
}

export interface StructuredResume {
  sections: ResumeSectionBlock[];
  contact: AtsContactInfo;
  warnings: string[];
  column_evidence: ColumnEvidence[];
  sections_unrecognized: UnrecognizedHeading[];
}

const SECTION_PATTERNS: [ResumeSection, RegExp][] = [
  ["summary", /^(professional\s+summary|summary|objective|profile|about(\s+me)?)$/i],
  ["experience", /^((work|professional|employment|relevant)\s+)?(experience|history)$/i],
  ["education", /^education(\s+(and|&)\s+training)?$/i],
  ["skills", /^((technical|core|key)\s+)?(skills|competencies|technologies)$/i],
  ["projects", /^((personal|selected|key)\s+)?projects$/i],
  ["certifications", /^(certifications?|licenses?(\s+(and|&)\s+certifications?)?)$/i],
];

function matchSectionHeading(line: string): ResumeSection | null {
  const trimmed = line.trim().replace(/:$/, "").trim();
  if (trimmed.length === 0 || trimmed.length > 40) return null;
  for (const [name, re] of SECTION_PATTERNS) {
    if (re.test(trimmed)) return name;
  }
  return null;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const LINK_RE = /(https?:\/\/[^\s|,)]+|(?:www\.|linkedin\.com\/|github\.com\/)[^\s|,)]+)/gi;

function findPhone(text: string): string | null {
  for (const m of text.match(PHONE_CANDIDATE_RE) ?? []) {
    const digits = m.replace(/\D/g, "");
    // Real phone numbers have 10-15 digits; date ranges ("2019 - 2023") have 8.
    if (digits.length >= 10 && digits.length <= 15) return m.trim();
  }
  return null;
}

// Only sections a résumé is normally expected to have. `projects` and
// `certifications` are never reported missing: plenty of good résumés have
// neither, and listing them implies they should exist — a judgement this
// product does not make.
const CORE_SECTIONS: ResumeSection[] = ["experience", "education", "skills"];

// The heading word IS in the document but the sectionizer rejected its line,
// almost always because a column merge pushed the line past the 40-char limit
// in matchSectionHeading. Naming the line number is what makes this fixable.
function findUnrecognizedHeadings(
  lines: string[],
  detected: Set<ResumeSection>
): UnrecognizedHeading[] {
  const found: UnrecognizedHeading[] = [];
  const seen = new Set<ResumeSection>();
  lines.forEach((line, i) => {
    if (matchSectionHeading(line) !== null) return;
    const m = line.match(/^(.*?\S) {3,}(\S.*)$/);
    if (!m) return;
    for (const fragment of [m[1].trim(), m[2].trim()]) {
      const section = matchSectionHeading(fragment);
      if (section === null || detected.has(section) || seen.has(section)) continue;
      seen.add(section);
      found.push({ section, line_number: i + 1, text: line });
    }
  });
  return found;
}

export function extractResumeStructure(text: string): StructuredResume {
  const sections: ResumeSectionBlock[] = [];
  let current: ResumeSectionBlock = { name: "contact", heading: "", lines: [] };

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "") continue;
    const matched = matchSectionHeading(raw);
    if (matched) {
      if (current.lines.length > 0 || current.heading !== "") sections.push(current);
      current = { name: matched, heading: raw.trim(), lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  if (current.lines.length > 0 || current.heading !== "") sections.push(current);

  const contact: AtsContactInfo = {
    email: text.match(EMAIL_RE)?.[0] ?? null,
    phone: findPhone(text),
    links: [...new Set([...text.matchAll(LINK_RE)].map((m) => m[0]))].slice(0, 5),
  };

  const warnings: string[] = [];
  const headed = sections.filter((s) => s.heading !== "");
  if (headed.length === 0) {
    warnings.push("No standard section headings detected — an ATS may fail to segment this resume.");
  }
  if (!contact.email) warnings.push("No email address found — ATS contact parsing will fail.");
  if (!contact.phone) warnings.push("No phone number found.");

  const garbled = (text.match(/\u{FFFD}/gu) ?? []).length;
  if (garbled > 0) {
    warnings.push(
      `${garbled} garbled ${garbled === 1 ? "character" : "characters"} found — the PDF text layer may be corrupted.`
    );
  }

  const allLines = text.split(/\r?\n/);
  const detected = new Set(sections.filter((s) => s.heading !== "").map((s) => s.name));
  const columnEvidence = detectMergedColumns(text, matchSectionHeading);
  if (columnEvidence.length > 0) {
    // Flows through evaluateParseGate's existing rule, which can only move
    // clean -> risky. No special-casing here, deliberately.
    warnings.push(
      "Text from two columns appears to have been merged into single lines — an ATS reads this as scrambled."
    );
  }

  return {
    sections,
    contact,
    warnings,
    column_evidence: columnEvidence,
    sections_unrecognized: findUnrecognizedHeadings(allLines, detected),
  };
}

export function toAtsExtraction(structured: StructuredResume): AtsExtraction {
  const detected = [
    ...new Set(structured.sections.filter((s) => s.heading !== "").map((s) => s.name)),
  ];
  const detectedSet = new Set(detected);
  const contactMissing: ("email" | "phone" | "links")[] = [];
  if (!structured.contact.email) contactMissing.push("email");
  if (!structured.contact.phone) contactMissing.push("phone");
  if (structured.contact.links.length === 0) contactMissing.push("links");

  return {
    sections_detected: detected,
    contact: structured.contact,
    warnings: structured.warnings,
    sections_missing: CORE_SECTIONS.filter((s) => !detectedSet.has(s)),
    sections_unrecognized: structured.sections_unrecognized,
    contact_missing: contactMissing,
    column_evidence: structured.column_evidence,
  };
}

export function buildSectionizedText(structured: StructuredResume): string {
  return structured.sections
    .map((s) => `[${s.name.toUpperCase()}]\n${s.lines.join("\n")}`)
    .join("\n\n");
}

export function sectionNames(structured: StructuredResume): string[] {
  return [...new Set(structured.sections.map((s) => s.name))];
}
