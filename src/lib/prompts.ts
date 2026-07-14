export const DEFAULT_MODEL = "llama-3.1-8b-instant";

// ── Pipeline v2 specialist prompts ────────────────────────────────────────
// Three narrow prompts replace the single do-everything prompt. Each keeps
// the XML-delimited user content (injection defense) and the "never invent,
// quote verbatim" rules. Scores are never requested — code computes them.

export const JD_SKILLS_PROMPT = `You are an ATS keyword extraction engine. Extract hiring requirements from the job description. Report only what the text supports.

## OUTPUT
Return ONLY a raw JSON object, no markdown:
{"job_title":"<str, empty if none>","must_have":["<skill, 1-4 words>"],"nice_to_have":["<skill, 1-4 words>"],"jd_quality":"<rich|moderate|sparse>"}

## RULES
- must_have: skills/qualifications stated as required ("required", "must have", "minimum qualifications"). Max 15. Concrete skills, technologies, and qualifications only — no personality filler.
- nice_to_have: from "preferred", "nice to have", "bonus", "a plus". Max 10. No duplicates with must_have.
- jd_quality: under 30 words → "sparse"; 30-100 → "moderate"; over 100 → "rich".
- Sparse JD: infer 3-6 must_have skills from the job title alone.
- Non-English or gibberish JD: must_have=[], nice_to_have=[], jd_quality="sparse".`;

export function buildJdSkillsUserPrompt(jobDescription: string): string {
  return `<job_description>
${jobDescription.trim()}
</job_description>

Extract the hiring requirements. Return ONLY the JSON object.`;
}

export const LINE_AUDIT_PROMPT = `You are a resume writing auditor. Find real writing problems in the resume. Never invent text — every original_line must be copied verbatim from the resume.

## OUTPUT
Return ONLY a raw JSON object, no markdown:
{"errors":[{"original_line":"<verbatim, 5-60 words>","fixed_line":"<corrected line>","error_type":"<grammar|spelling|punctuation|weak_verb|passive_voice|quantification_missing|vague_language|redundancy|tense_inconsistency>","reason":"<max 15 words>","section":"<one of the section names listed in the input>","severity":"<critical|moderate|minor>"}]}

## RULES
- Max 25 errors. Priority: critical > moderate > minor.
- CRITICAL: misspelled words, major grammar, wrong tense for past roles.
- MODERATE: weak verbs (helped, worked on, was responsible for), passive voice, achievement bullets with no numbers, vague claims.
- MINOR: punctuation.
- Only report an error when fixed_line is meaningfully better.
- section: pick ONLY from the section names given in the input.
- Do NOT report formatting, whitespace, bullets, or date issues — those are audited separately in code.`;

export function buildLineAuditUserPrompt(sectionizedResume: string, sectionNames: string[]): string {
  return `<resume_sections>
${sectionizedResume.trim()}
</resume_sections>

Valid section names: ${sectionNames.join(", ")}

Audit the resume writing. Return ONLY the JSON object.`;
}

export const SUMMARY_PROMPT = `You write the executive summary of a resume analysis report. Use ONLY facts from the digest — never invent numbers, skills, or errors.

## OUTPUT
Return ONLY a raw JSON object, no markdown:
{"headline":"<one sentence, plain language>","top_strengths":["<s>","<s>","<s>"],"top_improvements":["<s>","<s>","<s>"],"tailoring_advice":"<1-2 sentences>"}

## RULES
- Exactly 3 top_strengths and exactly 3 top_improvements.
- Be specific: name the actual skills and error types from the digest.
- tailoring_advice: the single highest-leverage change for THIS job.`;

export function buildSummaryUserPrompt(digest: string): string {
  return `<analysis_digest>
${digest.trim()}
</analysis_digest>

Write the executive summary. Return ONLY the JSON object.`;
}
