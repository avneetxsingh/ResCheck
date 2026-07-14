// Deterministic ATS-style resume sectionizer. No AI — what this file reports
// is by construction present in the text.
import type { ResumeSection, AtsContactInfo, AtsExtraction } from "@/types/analysis";

export interface ResumeSectionBlock {
  name: ResumeSection;
  heading: string; // verbatim heading line; "" for the contact preamble
  lines: string[]; // non-empty lines, trailing whitespace preserved for audit
}

export interface StructuredResume {
  sections: ResumeSectionBlock[];
  contact: AtsContactInfo;
  warnings: string[];
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
  const garbled = (text.match(/�/g) ?? []).length;
  if (garbled > 0) {
    warnings.push(`${garbled} garbled character(s) found — the PDF text layer may be corrupted.`);
  }

  return { sections, contact, warnings };
}

export function toAtsExtraction(structured: StructuredResume): AtsExtraction {
  return {
    sections_detected: [
      ...new Set(structured.sections.filter((s) => s.heading !== "").map((s) => s.name)),
    ],
    contact: structured.contact,
    warnings: structured.warnings,
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
