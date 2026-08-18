import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGroqClient, GROQ_MODEL, ALLOWED_MODELS } from "@/lib/groq";
import {
  JD_SKILLS_PROMPT, LINE_AUDIT_PROMPT, SUMMARY_PROMPT,
  buildJdSkillsUserPrompt, buildLineAuditUserPrompt, buildSummaryUserPrompt,
} from "@/lib/prompts";
import { extractResumeStructure, toAtsExtraction, buildSectionizedText, sectionNames } from "@/lib/ats-extract";
import { runFormattingAudit } from "@/lib/formatting-audit";
import { buildSkills, extractBonusSkills, clipJd, sanitizeSkillName, isNegatedInJd } from "@/lib/keyword-match";
import { computeScores, buildFallbackSummary, AUDIT_KEYS } from "@/lib/scoring";
import { segmentRoles } from "@/lib/work-history";
import type { ApiError } from "@/types/api";
import type { RawAnalysisResult } from "@/types/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Request body ───────────────────────────────────────────────────────────
// system_prompt is no longer accepted; zod strips unknown keys so old cached
// clients that still send it are unaffected.
const BodySchema = z.object({
  resume_text: z.string().min(100, "Resume text too short"),
  job_description: z.string().min(1, "Job description cannot be empty"),
  model: z
    .string()
    .optional()
    .refine((v) => v === undefined || ALLOWED_MODELS.has(v), {
      message: "Unknown model ID. Use a supported Groq model.",
    }),
});

// ── Input budgets ──────────────────────────────────────────────────────────
// Free tier is 6,000 tokens/min on the default model. Explicit budgets, not
// magic slices: ~4 chars/token.
const RESUME_BUDGET_CHARS = 12_000; // ~3.0K tokens (AI-2 only)
const JD_BUDGET_CHARS = 4_000; //     ~1.0K tokens (AI-1 only)

// ── Per-stage Zod schemas — every field and sub-object catches ────────────
const JdSkillsSchema = z
  .object({
    job_title: z.string().catch(""),
    must_have: z
      .array(z.string())
      .catch([])
      .transform((a) => a.map(sanitizeSkillName).filter((s): s is string => s !== null).slice(0, 15)),
    nice_to_have: z
      .array(z.string())
      .catch([])
      .transform((a) => a.map(sanitizeSkillName).filter((s): s is string => s !== null).slice(0, 10)),
    jd_quality: z.enum(["rich", "moderate", "sparse"]).catch("moderate"),
  })
  .catch({ job_title: "", must_have: [], nice_to_have: [], jd_quality: "moderate" });
type JdSkills = z.infer<typeof JdSkillsSchema>;

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

// Raw role record as reported by AI-2. header_line is the only anchor used to
// locate the role in the resume text, so every field just falls back to "" —
// segmentRoles treats an empty header_line as unanchored, never a thrown error.
const RawRoleSchema = z.object({
  header_line: z.string().catch(""),
  employer: z.string().catch(""),
  title: z.string().catch(""),
  start: z.string().catch(""),
  end: z.string().catch(""),
});

const LineErrorsSchema = z
  .object({
    errors: z.array(LineErrorSchema).catch([]).transform((a) => a.slice(0, 40)),
    roles: z
      .array(RawRoleSchema)
      .catch([])
      .transform((a) => a.filter((r) => r.header_line.trim().length > 0).slice(0, 10)),
  })
  .catch({ errors: [], roles: [] });

const SummarySchema = z
  .object({
    headline: z.string().catch(""),
    top_strengths: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
    top_improvements: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
    tailoring_advice: z.string().catch(""),
  })
  .catch({ headline: "", top_strengths: [], top_improvements: [], tailoring_advice: "" });

// ── SSE helpers ────────────────────────────────────────────────────────────
const encoder = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Groq stage call: 25s timeout, retry once at temp 0.2, 429 retry-after ─
type StageResult<T> =
  | { ok: true; data: T; actualModel: string }
  | { ok: false; reason: "auth" | "model_gone" | "failed" };

async function callStage<T>(opts: {
  groq: ReturnType<typeof createGroqClient>;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  onWarning: (msg: string) => void;
}): Promise<StageResult<T>> {
  const attempt = async (temperature: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const completion = await opts.groq.chat.completions.create(
        {
          model: opts.model,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: opts.userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: opts.maxTokens,
        },
        { signal: controller.signal }
      );
      return {
        rawText: completion.choices[0]?.message?.content ?? "",
        actualModel: completion.model ?? opts.model,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  // temperature 0 first; the retry MUST use 0.2 so it can produce different output
  const temps = [0, 0.2];
  for (let i = 0; i < temps.length; i++) {
    try {
      const { rawText, actualModel } = await attempt(temps[i]);
      const parsed: unknown = JSON.parse(rawText); // schema.safeParse cannot fail; JSON.parse can
      const validated = opts.schema.safeParse(parsed);
      if (validated.success) return { ok: true, data: validated.data, actualModel };
      // .catch()-everywhere means this is unreachable, but stay defensive:
      if (i === 0) opts.onWarning("The model returned something unusable — retrying.");
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" ? (err as Record<string, unknown>).status : undefined;
      if (status === 401) return { ok: false, reason: "auth" };
      // A retired or unknown model fails identically on every retry, so return
      // immediately rather than burning the retry and reporting it as transient.
      const detail =
        err && typeof err === "object" ? String((err as Record<string, unknown>).message ?? "") : "";
      if (status === 404 || (status === 400 && /decommission|does not exist|not found|unsupported/i.test(detail))) {
        return { ok: false, reason: "model_gone" };
      }
      if (status === 429 && i === 0) {
        const headers =
          err && typeof err === "object"
            ? ((err as Record<string, unknown>).headers as Record<string, string> | undefined)
            : undefined;
        const retryAfter = Number(headers?.["retry-after"] ?? NaN);
        if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 20) {
          opts.onWarning(`Groq is rate-limiting — pausing ${retryAfter}s, then retrying.`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return { ok: false, reason: "failed" };
      }
      if (i === 0) opts.onWarning("A model call failed — retrying once.");
    }
  }
  return { ok: false, reason: "failed" };
}

// ── Route ──────────────────────────────────────────────────────────────────
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
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid request body" : "Invalid request body";
    return NextResponse.json<ApiError>({ error: message, code: "INVALID_REQUEST" }, { status: 400 });
  }

  const groq = createGroqClient(apiKey.trim());
  const model = body.model ?? GROQ_MODEL;
  const resumeText = body.resume_text.slice(0, RESUME_BUDGET_CHARS);
  // Requirements-aware clip: long postings keep their requirements section
  // instead of losing it to head-truncation.
  const jdText = clipJd(body.job_description, JD_BUDGET_CHARS);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const warnings: string[] = [];
      const emit = (event: string, data: unknown) => controller.enqueue(sse(event, data));
      const warn = (message: string) => {
        warnings.push(message);
        emit("warning", { message });
      };

      try {
        // Stage 1 — deterministic extraction (code, cannot fail on valid text)
        emit("stage", { stage: "extracting", progress: 10 });
        const structured = extractResumeStructure(resumeText);
        const audit = runFormattingAudit(structured);
        const atsExtraction = toAtsExtraction(structured);

        // Stage 2+3 — AI-1 (JD skills) ∥ AI-2 (line audit)
        emit("stage", { stage: "skills", progress: 25 });
        const jdPromise = callStage({
          groq, model, systemPrompt: JD_SKILLS_PROMPT,
          userPrompt: buildJdSkillsUserPrompt(jdText),
          schema: JdSkillsSchema, maxTokens: 500, onWarning: warn,
        });
        const errorsPromise = callStage({
          groq, model, systemPrompt: LINE_AUDIT_PROMPT,
          userPrompt: buildLineAuditUserPrompt(buildSectionizedText(structured), sectionNames(structured)),
          schema: LineErrorsSchema, maxTokens: 1800, onWarning: warn,
        });

        const jdOutcome = await jdPromise;
        emit("stage", { stage: "errors", progress: 50 });
        const errorsOutcome = await errorsPromise;
        emit("stage", { stage: "scoring", progress: 70 });

        if (
          (!jdOutcome.ok && jdOutcome.reason === "auth") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "auth")
        ) {
          emit("error", { error: "Invalid Groq API key. Check your key and try again.", code: "INVALID_KEY" });
          controller.close();
          return;
        }
        if (
          (!jdOutcome.ok && jdOutcome.reason === "model_gone") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "model_gone")
        ) {
          emit("error", {
            error: `Groq has retired "${model}", so it can no longer run an analysis. Pick a different model in Settings.`,
            code: "INVALID_REQUEST",
          });
          controller.close();
          return;
        }
        if (!jdOutcome.ok && !errorsOutcome.ok) {
          emit("error", { error: "The model couldn't complete the analysis, even after retries. Try again in a minute, or switch models in Settings.", code: "UNKNOWN" });
          controller.close();
          return;
        }

        const jd: JdSkills = jdOutcome.ok
          ? jdOutcome.data
          : { job_title: "", must_have: [], nice_to_have: [], jd_quality: "sparse" };
        if (!jdOutcome.ok) warn("Couldn't extract skills from the job description this run — the Skills tab will be empty.");

        const errors = errorsOutcome.ok ? errorsOutcome.data.errors : [];
        const rawRoles = errorsOutcome.ok ? errorsOutcome.data.roles : [];
        if (!errorsOutcome.ok) warn("The writing audit didn't complete — no line issues are shown, and grammar/impact scores assume none.");

        const roles = segmentRoles(structured, rawRoles);
        if (rawRoles.length > 0 && roles.every((r) => !r.anchored)) {
          warn("Couldn't locate your job entries in the resume text — skill recency isn't factored into this run.");
        }
        const skillOpts = { structured, roles };
        // "No Kubernetes experience required" must not register as a requirement.
        // This runs here rather than in the zod transform because the transform
        // has no access to the job-description text.
        const notNegated = (name: string) => !isNegatedInJd(name, jdText);

        // Stage 4 — deterministic matching + scoring (code)
        const mustHave = buildSkills(jd.must_have.filter(notNegated), resumeText, skillOpts);
        const niceToHave = buildSkills(jd.nice_to_have.filter(notNegated), resumeText, skillOpts);
        const bonusSkills = extractBonusSkills(structured, [...jd.must_have, ...jd.nice_to_have]);
        const scoring = computeScores({
          errors, formattingAudit: audit, mustHave, niceToHave,
          parseWarningCount: structured.warnings.length,
        });

        // Stage 5 — AI-3 summary from a compact factual digest
        emit("stage", { stage: "summary", progress: 85 });
        const sc = scoring.scorecard;
        const missingMust = mustHave.filter((s) => s.match_strength === "missing").map((s) => s.name);
        const auditCount = AUDIT_KEYS.reduce((n, k) => n + audit[k].length, 0);
        const digest = [
          `Job title: ${jd.job_title || "unknown"}`,
          `JD quality: ${jd.jd_quality}`,
          `Overall ATS score: ${sc.overall_ats_score.score}/100 (verdict: ${scoring.verdict})`,
          `Must-have skills matched: ${mustHave.filter((s) => s.match_strength !== "missing").length}/${mustHave.length}`,
          `Missing must-have skills: ${missingMust.join(", ") || "none"}`,
          `Bonus skills on resume: ${bonusSkills.slice(0, 6).join(", ") || "none"}`,
          `Writing errors: ${errors.length} (${errors.filter((e) => e.severity === "critical").length} critical)`,
          `Top errors: ${errors.slice(0, 5).map((e) => `${e.error_type}: ${e.reason}`).join("; ") || "none"}`,
          `Formatting inconsistencies: ${auditCount}`,
          `Scores — skills ${sc.skills_match_score.score}, keywords ${sc.keyword_density_score.score}, impact ${sc.impact_score.score}, grammar ${sc.grammar_score.score}, formatting ${sc.formatting_score.score}`,
        ].join("\n");

        const summaryOutcome = await callStage({
          groq, model, systemPrompt: SUMMARY_PROMPT,
          userPrompt: buildSummaryUserPrompt(digest),
          schema: SummarySchema, maxTokens: 500, onWarning: warn,
        });

        const fallback = buildFallbackSummary(scoring, mustHave, errors, bonusSkills);
        const summary =
          summaryOutcome.ok && summaryOutcome.data.headline
            ? {
                verdict: scoring.verdict,
                headline: summaryOutcome.data.headline,
                top_strengths:
                  summaryOutcome.data.top_strengths.length === 3
                    ? summaryOutcome.data.top_strengths
                    : fallback.top_strengths,
                top_improvements:
                  summaryOutcome.data.top_improvements.length === 3
                    ? summaryOutcome.data.top_improvements
                    : fallback.top_improvements,
                tailoring_advice: summaryOutcome.data.tailoring_advice || fallback.tailoring_advice,
              }
            : fallback;
        if (!summaryOutcome.ok) warn("The AI summary didn't come back — showing one built from the scores instead.");

        const actualModel =
          (jdOutcome.ok && jdOutcome.actualModel) ||
          (errorsOutcome.ok && errorsOutcome.actualModel) ||
          model;

        const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
        const result: RawAnalysisResult = {
          scorecard: scoring.scorecard,
          skills_gap: {
            must_have: mustHave,
            nice_to_have: niceToHave,
            bonus_skills: bonusSkills,
            overall_match_percentage: scoring.overallMatchPercentage,
          },
          errors,
          formatting_audit: audit,
          ats_extraction: atsExtraction,
          warnings,
          summary,
          metadata: {
            model: actualModel,
            resume_word_count: words(resumeText),
            jd_word_count: words(jdText),
            jd_quality: jd.jd_quality,
            total_errors_found: errors.length,
            pipeline_version: 2,
          },
        };

        emit("result", { result });
        controller.close();
      } catch (err) {
        console.error("[analyze]", err);
        emit("error", { error: "Analysis failed. Please try again.", code: "UNKNOWN" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
