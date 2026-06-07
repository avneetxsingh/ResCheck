import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGroqClient, GROQ_MODEL, ALLOWED_MODELS } from "@/lib/groq";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import type { ApiError, AnalyzeResponse } from "@/types/api";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Request body schema ---
const BodySchema = z.object({
  resume_text: z.string().min(100, "Resume text too short"),
  job_description: z.string().min(1, "Job description cannot be empty"),
  model: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || ALLOWED_MODELS.has(v),
      { message: "Unknown model ID. Use a supported Groq model." }
    ),
  system_prompt: z.string().optional(),
});

// --- Zod schemas for deep AI response validation ---
// Every field AND every sub-object has a .catch() — safeParse is literally impossible to fail.

const DEFAULT_METRIC = { score: 0, label: "", rationale: "", improvement_tip: "" } as const;

const ScorecardMetricSchema = z.object({
  score: z.number().catch(0).transform((n) => Math.min(100, Math.max(0, Math.round(n)))),
  label: z.string().catch(""),
  rationale: z.string().catch(""),
  improvement_tip: z.string().catch(""),
}).catch(DEFAULT_METRIC);

const ERROR_TYPES = [
  "grammar", "spelling", "punctuation", "weak_verb", "passive_voice",
  "quantification_missing", "vague_language", "keyword_missing", "formatting",
  "ats_unfriendly", "redundancy", "tense_inconsistency", "extra_whitespace",
  "inconsistent_bold", "inconsistent_bullets", "date_format",
  "capitalization_inconsistency",
] as const;

const RESUME_SECTIONS = [
  "contact", "summary", "experience", "education",
  "skills", "projects", "certifications", "other",
] as const;

const SkillSchema = z.object({
  name: z.string().catch(""),
  present_in_resume: z.boolean().catch(false),
  category: z.string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["technical", "soft", "domain", "tool"]))
    .catch("technical"),
  match_strength: z.string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["exact", "partial", "missing"]))
    .catch("missing"),
});

const LineErrorSchema = z.object({
  original_line: z.string().catch(""),
  fixed_line: z.string().catch(""),
  error_type: z.string()
    .transform((s) => s.toLowerCase().replace(/[\s-]+/g, "_"))
    .pipe(z.enum(ERROR_TYPES))
    .catch("formatting"),
  reason: z.string().catch(""),
  section: z.string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(RESUME_SECTIONS))
    .catch("other"),
  severity: z.enum(["critical", "moderate", "minor"]).catch("minor"),
});

const FormattingAuditSchema = z.object({
  whitespace_issues: z.array(z.string()).catch([]),
  bold_inconsistencies: z.array(z.string()).catch([]),
  bullet_inconsistencies: z.array(z.string()).catch([]),
  date_format_issues: z.array(z.string()).catch([]),
  capitalization_issues: z.array(z.string()).catch([]),
  other_inconsistencies: z.array(z.string()).catch([]),
  is_clean: z.boolean().catch(true),
});

const bonusSkillsSchema = z.array(z.unknown()).catch([]).transform((arr) =>
  arr
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return typeof obj.name === "string" ? obj.name : null;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.trim() !== "")
);

const DEFAULT_SCORECARD = {
  overall_ats_score: DEFAULT_METRIC,
  skills_match_score: DEFAULT_METRIC,
  grammar_score: DEFAULT_METRIC,
  formatting_score: DEFAULT_METRIC,
  impact_score: DEFAULT_METRIC,
  keyword_density_score: DEFAULT_METRIC,
};

const DEFAULT_AUDIT = {
  whitespace_issues: [] as string[],
  bold_inconsistencies: [] as string[],
  bullet_inconsistencies: [] as string[],
  date_format_issues: [] as string[],
  capitalization_issues: [] as string[],
  other_inconsistencies: [] as string[],
  is_clean: true,
};

const AiResponseSchema = z.object({
  scorecard: z.object({
    overall_ats_score: ScorecardMetricSchema,
    skills_match_score: ScorecardMetricSchema,
    grammar_score: ScorecardMetricSchema,
    formatting_score: ScorecardMetricSchema,
    impact_score: ScorecardMetricSchema,
    keyword_density_score: ScorecardMetricSchema,
  }).catch(DEFAULT_SCORECARD),
  skills_gap: z.object({
    must_have: z.array(SkillSchema).catch([]),
    nice_to_have: z.array(SkillSchema).catch([]),
    bonus_skills: bonusSkillsSchema,
    overall_match_percentage: z.number().catch(0)
      .transform((n) => Math.min(100, Math.max(0, Math.round(n)))),
  }).catch({ must_have: [], nice_to_have: [], bonus_skills: [], overall_match_percentage: 0 }),
  errors: z.array(LineErrorSchema).catch([]),
  formatting_audit: FormattingAuditSchema.catch(DEFAULT_AUDIT),
  summary: z.object({
    verdict: z.enum(["strong", "moderate", "needs_work", "critical"]).catch("moderate"),
    headline: z.string().catch(""),
    top_strengths: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
    top_improvements: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
    tailoring_advice: z.string().catch(""),
  }).catch({ verdict: "moderate" as const, headline: "", top_strengths: [], top_improvements: [], tailoring_advice: "" }),
  metadata: z.object({
    model: z.string().catch("unknown"),
    resume_word_count: z.number().catch(0).transform(Math.round),
    jd_word_count: z.number().catch(0).transform(Math.round),
    jd_quality: z.enum(["rich", "moderate", "sparse"]).catch("moderate"),
    total_errors_found: z.number().catch(0).transform(Math.round),
  }).catch({ model: "unknown", resume_word_count: 0, jd_word_count: 0, jd_quality: "moderate" as const, total_errors_found: 0 }),
});

type AiResponse = z.infer<typeof AiResponseSchema>;

// --- Shared Groq call helper (reused for retry) ---
async function callGroq(
  groq: ReturnType<typeof createGroqClient>,
  model: string,
  systemPrompt: string,
  resumeText: string,
  jobDescription: string,
  temperature = 0   // 0 = greedy/deterministic; retries use 0.2 to get different output
): Promise<{ rawText: string; actualModel: string }> {
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(resumeText, jobDescription) },
    ],
    response_format: { type: "json_object" },
    temperature,
    max_tokens: 2000,
  });
  const rawText = completion.choices[0]?.message?.content ?? "";
  const actualModel = completion.model ?? model;
  return { rawText, actualModel };
}

// --- Parse + validate with optional retry ---
async function parseAndValidate(
  groq: ReturnType<typeof createGroqClient>,
  model: string,
  systemPrompt: string,
  resumeText: string,
  jobDescription: string
): Promise<{ result: AiResponse; actualModel: string } | { error: string }> {
  let rawText: string;
  let actualModel: string;

  // Attempt 1
  try {
    ({ rawText, actualModel } = await callGroq(groq, model, systemPrompt, resumeText, jobDescription));
  } catch (err) {
    throw err; // Groq SDK errors propagate to outer catch for status-code handling
  }

  if (!rawText.trim()) {
    return { error: "AI returned an empty response." };
  }

  // JSON parse — retry once on failure (temperature 0.2 so retry differs from attempt 1)
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    try {
      ({ rawText, actualModel } = await callGroq(groq, model, systemPrompt, resumeText, jobDescription, 0.2));
      parsed = JSON.parse(rawText);
    } catch {
      return { error: "AI returned invalid JSON after retry. Please try again." };
    }
  }

  // Shape validation — retry once on failure (temperature 0.2 so retry differs from attempt 1)
  const validated = AiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    try {
      ({ rawText, actualModel } = await callGroq(groq, model, systemPrompt, resumeText, jobDescription, 0.2));
      const reparsed = JSON.parse(rawText);
      const revalidated = AiResponseSchema.safeParse(reparsed);
      if (!revalidated.success) {
        console.error("[analyze] shape validation failed after retry:", revalidated.error.issues[0]);
        return { error: "AI response structure was invalid after retry. Please try again." };
      }
      return { result: revalidated.data, actualModel };
    } catch {
      return { error: "AI response was invalid. Please try again." };
    }
  }

  return { result: validated.data, actualModel };
}

const AUDIT_KEYS = [
  "whitespace_issues",
  "bold_inconsistencies",
  "bullet_inconsistencies",
  "date_format_issues",
  "capitalization_issues",
  "other_inconsistencies",
] as const;

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-groq-api-key");
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json<ApiError>(
      { error: "Groq API key required. Pass it via the x-groq-api-key header.", code: "INVALID_KEY" },
      { status: 401 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Invalid request body"
        : "Invalid request body";
    return NextResponse.json<ApiError>(
      { error: message, code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const groq = createGroqClient(apiKey.trim());
    const model = body.model ?? GROQ_MODEL;
    // Always use the server-side SYSTEM_PROMPT — this prevents stale localStorage prompts
    // from previous sessions overriding the current prompt. The Settings prompt editor is
    // kept for display purposes but the server is the source of truth.
    const systemPrompt = SYSTEM_PROMPT;

    // Truncate inputs to stay within the free-tier TPM limit (~6000 input tokens).
    // System prompt ≈ 1800 tokens, leaving ~4200 tokens for resume + JD.
    const resumeText = body.resume_text.slice(0, 12000); // ~3000 tokens
    const jdText = body.job_description.slice(0, 4000);  // ~1000 tokens

    const outcome = await parseAndValidate(
      groq, model, systemPrompt, resumeText, jdText
    );

    if ("error" in outcome) {
      return NextResponse.json<ApiError>(
        { error: outcome.error, code: "INVALID_JSON" },
        { status: 422 }
      );
    }

    const { result, actualModel } = outcome;

    // ── SERVER-SIDE DETERMINISTIC SCORING ──────────────────────────────────
    // AI outputs score=0 for all fields. These computations are the ground truth.

    // 1. formatting_score — from formatting_audit issue count
    const auditCount = AUDIT_KEYS.reduce((n, k) => n + result.formatting_audit[k].length, 0);
    result.scorecard.formatting_score.score =
      auditCount === 0 ? 95 :
      auditCount <= 2  ? 82 :
      auditCount <= 5  ? 67 :
      auditCount <= 10 ? 50 : 35;

    // 2. grammar_score — grammar/spelling/punctuation/tense errors
    const GRAMMAR_TYPES = new Set(["grammar", "spelling", "punctuation", "tense_inconsistency"]);
    const grammarCount = result.errors.filter(e => GRAMMAR_TYPES.has(e.error_type)).length;
    result.scorecard.grammar_score.score =
      grammarCount === 0 ? 95 :
      grammarCount <= 3  ? 82 :
      grammarCount <= 7  ? 67 : 45;

    // 3. impact_score — weak verbs/passive/unquantified/vague errors
    const IMPACT_TYPES = new Set(["quantification_missing", "weak_verb", "passive_voice", "vague_language"]);
    const impactCount = result.errors.filter(e => IMPACT_TYPES.has(e.error_type)).length;
    result.scorecard.impact_score.score =
      impactCount === 0 ? 90 :
      impactCount <= 2  ? 75 :
      impactCount <= 5  ? 60 :
      impactCount <= 9  ? 45 : 30;

    // 4. skills_match_score — must_have 80% weight, nice_to_have 20%
    const mustHave = result.skills_gap.must_have;
    const niceToHave = result.skills_gap.nice_to_have;
    const mustHaveRatio = mustHave.length === 0 ? 1.0 :
      mustHave.reduce((sum, s) =>
        sum + (s.match_strength === "exact" ? 1 : s.match_strength === "partial" ? 0.5 : 0), 0
      ) / mustHave.length;
    const niceToHaveRatio = niceToHave.length === 0 ? 1.0 :
      niceToHave.reduce((sum, s) =>
        sum + (s.match_strength === "exact" ? 1 : s.match_strength === "partial" ? 0.5 : 0), 0
      ) / niceToHave.length;
    result.scorecard.skills_match_score.score =
      Math.round((mustHaveRatio * 0.8 + niceToHaveRatio * 0.2) * 100);

    // 5. keyword_density_score — present skills / total skills (binary)
    const allSkills = [...mustHave, ...niceToHave];
    result.scorecard.keyword_density_score.score =
      allSkills.length === 0 ? 50 :
      Math.round(allSkills.filter(s => s.present_in_resume).length / allSkills.length * 100);

    // 6. overall_match_percentage — synced with skills_match_score
    result.skills_gap.overall_match_percentage = result.scorecard.skills_match_score.score;

    // 7. overall_ats_score — weighted formula
    const sc = result.scorecard;
    sc.overall_ats_score.score = Math.round(
      sc.skills_match_score.score    * 0.35 +
      sc.keyword_density_score.score * 0.20 +
      sc.impact_score.score          * 0.20 +
      sc.grammar_score.score         * 0.15 +
      sc.formatting_score.score      * 0.10
    );

    // 8. verdict — derived from overall_ats_score
    result.summary.verdict =
      sc.overall_ats_score.score >= 80 ? "strong"     :
      sc.overall_ats_score.score >= 65 ? "moderate"   :
      sc.overall_ats_score.score >= 50 ? "needs_work" : "critical";

    // 9. is_clean + metadata
    result.formatting_audit.is_clean = AUDIT_KEYS.every(k => result.formatting_audit[k].length === 0);
    result.metadata.model = actualModel;
    result.metadata.total_errors_found = result.errors.length;
    // ── END SERVER-SIDE SCORING ──────────────────────────────────────────────

    return NextResponse.json<AnalyzeResponse>({ result });
  } catch (err: unknown) {
    if (err && typeof err === "object") {
      const errObj = err as Record<string, unknown>;
      const status = errObj.status as number | undefined;
      if (status === 401) {
        return NextResponse.json<ApiError>(
          { error: "Invalid Groq API key. Check your key and try again.", code: "INVALID_KEY" },
          { status: 401 }
        );
      }
      if (status === 413) {
        return NextResponse.json<ApiError>(
          { error: "Request too large for this model's free tier. Switch to a larger model in Settings (e.g. Llama 3.3 70B) or try a shorter resume.", code: "RATE_LIMITED" },
          { status: 413 }
        );
      }
      if (status === 429) {
        return NextResponse.json<ApiError>(
          { error: "Groq rate limit reached. Free tier allows ~30 requests/minute. Try again shortly.", code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
    }
    console.error("[analyze]", err);
    return NextResponse.json<ApiError>(
      { error: "Analysis failed. Please try again.", code: "UNKNOWN" },
      { status: 500 }
    );
  }
}
