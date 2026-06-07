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

const ScorecardMetricSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.string(),
  rationale: z.string(),
  improvement_tip: z.string(),
});

const SkillSchema = z.object({
  name: z.string(),
  present_in_resume: z.boolean(),
  category: z.enum(["technical", "soft", "domain", "tool"]),
  match_strength: z.enum(["exact", "partial", "missing"]),
});

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

const LineErrorSchema = z.object({
  original_line: z.string(),
  fixed_line: z.string(),
  error_type: z.string()
    .transform((s) => s.toLowerCase().replace(/[\s\-]+/g, "_"))
    .pipe(z.enum(ERROR_TYPES))
    .catch("formatting"),
  reason: z.string(),
  section: z.string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(RESUME_SECTIONS))
    .catch("other"),
  severity: z.enum(["critical", "moderate", "minor"]).catch("minor"),
});

const FormattingAuditSchema = z.object({
  whitespace_issues: z.array(z.string()).default([]),
  bold_inconsistencies: z.array(z.string()).default([]),
  bullet_inconsistencies: z.array(z.string()).default([]),
  date_format_issues: z.array(z.string()).default([]),
  capitalization_issues: z.array(z.string()).default([]),
  other_inconsistencies: z.array(z.string()).default([]),
  is_clean: z.boolean(),
});

const AiResponseSchema = z.object({
  scorecard: z.object({
    overall_ats_score: ScorecardMetricSchema,
    skills_match_score: ScorecardMetricSchema,
    grammar_score: ScorecardMetricSchema,
    formatting_score: ScorecardMetricSchema,
    impact_score: ScorecardMetricSchema,
    keyword_density_score: ScorecardMetricSchema,
  }),
  skills_gap: z.object({
    must_have: z.array(SkillSchema),
    nice_to_have: z.array(SkillSchema),
    // Normalize bonus_skills: coerce objects to their name string, filter nulls/blanks
    bonus_skills: z.array(z.unknown()).transform((arr) =>
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
    ),
    overall_match_percentage: z.number().int().min(0).max(100),
  }),
  errors: z.array(LineErrorSchema).max(40),
  formatting_audit: FormattingAuditSchema,
  summary: z.object({
    verdict: z.enum(["strong", "moderate", "needs_work", "critical"]),
    headline: z.string(),
    top_strengths: z.array(z.string()).min(1).transform((a) => a.slice(0, 3)),
    top_improvements: z.array(z.string()).min(1).transform((a) => a.slice(0, 3)),
    tailoring_advice: z.string(),
  }),
  metadata: z.object({
    model: z.string(),
    resume_word_count: z.number().int().min(0),
    jd_word_count: z.number().int().min(0),
    jd_quality: z.enum(["rich", "moderate", "sparse"]),
    total_errors_found: z.number().int().min(0),
  }),
});

type AiResponse = z.infer<typeof AiResponseSchema>;

// --- Shared Groq call helper (reused for retry) ---
async function callGroq(
  groq: ReturnType<typeof createGroqClient>,
  model: string,
  systemPrompt: string,
  resumeText: string,
  jobDescription: string
): Promise<{ rawText: string; actualModel: string }> {
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(resumeText, jobDescription) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
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

  // JSON parse — retry once on failure
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    try {
      ({ rawText, actualModel } = await callGroq(groq, model, systemPrompt, resumeText, jobDescription));
      parsed = JSON.parse(rawText);
    } catch {
      return { error: "AI returned invalid JSON after retry. Please try again." };
    }
  }

  // Shape validation — retry once on failure
  const validated = AiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    try {
      ({ rawText, actualModel } = await callGroq(groq, model, systemPrompt, resumeText, jobDescription));
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
    // If a custom system prompt is provided but exceeds the safe char limit,
    // fall back to the default. The old long prompt stored in localStorage was
    // ~16000 chars which alone exceeds the free-tier TPM limit.
    const MAX_SYSTEM_PROMPT_CHARS = 6000;
    const systemPrompt =
      body.system_prompt && body.system_prompt.length <= MAX_SYSTEM_PROMPT_CHARS
        ? body.system_prompt
        : SYSTEM_PROMPT;

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

    // Server-side corrections — always authoritative, never trust AI's values
    result.metadata.model = actualModel;
    result.metadata.total_errors_found = result.errors.length;

    // Recompute is_clean from actual arrays
    result.formatting_audit.is_clean = AUDIT_KEYS.every(
      (k) => result.formatting_audit[k].length === 0
    );

    // Recompute formatting_score from actual audit issue count (AI always gets this wrong)
    const auditCount = AUDIT_KEYS.reduce((n, k) => n + result.formatting_audit[k].length, 0);
    result.scorecard.formatting_score.score =
      auditCount === 0 ? 95 :
      auditCount <= 2 ? 82 :
      auditCount <= 5 ? 67 :
      auditCount <= 10 ? 50 : 35;

    // Recompute overall_ats_score from weighted formula — AI ignores the formula and outputs ~85
    const s = result.scorecard;
    s.overall_ats_score.score = Math.round(
      s.skills_match_score.score  * 0.35 +
      s.keyword_density_score.score * 0.20 +
      s.impact_score.score        * 0.20 +
      s.grammar_score.score       * 0.15 +
      s.formatting_score.score    * 0.10
    );

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
