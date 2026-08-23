import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_PROVIDER, PROVIDERS, isProviderId, resolveProvider } from "@/lib/providers";
import type { Provider } from "@/lib/providers";
import {
  JD_SKILLS_PROMPT, LINE_AUDIT_PROMPT, SUMMARY_PROMPT,
  buildJdSkillsUserPrompt, buildLineAuditUserPrompt, buildSummaryUserPrompt,
} from "@/lib/prompts";
import { extractResumeStructure, toAtsExtraction, buildSectionizedText, sectionNames } from "@/lib/ats-extract";
import { runFormattingAudit } from "@/lib/formatting-audit";
import { buildSkills, extractBonusSkills, clipJd, sanitizeSkillName, isNegatedInJd } from "@/lib/keyword-match";
import { computeScores, buildFallbackSummary, AUDIT_KEYS } from "@/lib/scoring";
import { segmentRoles, computeWorkHistoryMetrics } from "@/lib/work-history";
import { buildFunnel, deriveFunnelVerdict, normalizeRequirementType } from "@/lib/funnel";
import type { ApiError } from "@/types/api";
import type { JdRequirement, RawAnalysisResult } from "@/types/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Request body ───────────────────────────────────────────────────────────
// system_prompt is no longer accepted; zod strips unknown keys so old cached
// clients that still send it are unaffected.
const BodySchema = z.object({
  // Upper bounds are far above any real résumé or posting, and far above the
  // per-provider clips applied further down. They exist so an oversized body
  // is rejected outright rather than fully buffered and then sliced — this
  // route is unauthenticated up to the first provider call.
  resume_text: z
    .string()
    .min(100, "Resume text too short")
    .max(400_000, "That resume is unexpectedly large. Re-export the PDF and try again."),
  job_description: z
    .string()
    .min(1, "Job description cannot be empty")
    .max(200_000, "That job description is unexpectedly large. Paste just the posting."),
  provider: z
    .string()
    .optional()
    .refine((v) => v === undefined || isProviderId(v), { message: "Unknown provider." }),
  // Validated against the resolved provider's own list once both are known —
  // a model is only meaningful relative to the provider that serves it.
  model: z.string().optional(),
});

// ── Per-stage Zod schemas — every field and sub-object catches ────────────
// The model does not reliably emit plain strings — it sometimes wraps a skill
// in an object. With only an array-level catch, ONE malformed element threw
// away every valid skill beside it, which is why extraction worked on some
// runs and silently returned nothing on others. Catching per item keeps the
// siblings: a bad element becomes "" and is dropped by sanitizeSkillName.
const SkillNameSchema = z
  .union([
    z.string(),
    z.object({ name: z.string() }).transform((o) => o.name),
    z.object({ skill: z.string() }).transform((o) => o.skill),
    z.object({ text: z.string() }).transform((o) => o.text),
  ])
  .catch("");

const skillList = (max: number) =>
  z
    .array(SkillNameSchema)
    .catch([])
    .transform((a) =>
      a.map(sanitizeSkillName).filter((s): s is string => s !== null).slice(0, max)
    );

// Per-item catch, exactly like SkillNameSchema: an array-level catch alone
// throws away every valid sibling when one element is malformed. An
// unrecognized type resolves to null and the item is dropped rather than
// becoming a check the posting never stated.
const RequirementItemSchema = z
  .object({
    type: z.string().catch(""),
    value: z.union([z.string(), z.number()]).catch("").transform(String),
    required: z.union([z.boolean(), z.string(), z.number()]).catch(true),
  })
  .catch({ type: "", value: "", required: true });

const requirementList = z
  .array(RequirementItemSchema)
  .catch([])
  .transform((items) =>
    items
      .map((r) => ({
        type: normalizeRequirementType(r.type),
        value: r.value.trim(),
        // The prompt tells the model to word an optional item as
        // preferred/bonus/a plus/nice to have, so every one of those must
        // coerce to false. A missed marker turns a preferred item into a
        // knockout, and a failed knockout forces a critical verdict.
        required:
          typeof r.required === "boolean"
            ? r.required
            : !/^(false|no|0|preferred|optional|bonus|(a\s+)?plus|nice[\s_-]?to[\s_-]?have)$/i.test(
                String(r.required).trim()
              ),
      }))
      .filter((r): r is JdRequirement => r.type !== null && r.value.length > 0)
      .slice(0, 10)
  );

const JdSkillsSchema = z
  .object({
    job_title: z.string().catch(""),
    must_have: skillList(15),
    nice_to_have: skillList(10),
    requirements: requirementList,
    jd_quality: z.enum(["rich", "moderate", "sparse"]).catch("moderate"),
  })
  .catch({ job_title: "", must_have: [], nice_to_have: [], requirements: [], jd_quality: "moderate" });
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

// ── Stage call: 25s timeout, retry once at temp 0.2, rate-limit delay once ─
type StageResult<T> =
  | { ok: true; data: T; actualModel: string }
  | { ok: false; reason: "auth" | "model_gone" | "failed"; detail?: string };

async function callStage<T>(opts: {
  provider: Provider;
  apiKey: string;
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
      return await opts.provider.complete(opts.apiKey, {
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        userPrompt: opts.userPrompt,
        temperature,
        maxTokens: opts.maxTokens,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // temperature 0 first; the retry MUST use 0.2 so it can produce different output
  const temps = [0, 0.2];
  let lastDetail = "";
  for (let i = 0; i < temps.length; i++) {
    try {
      const { rawText, actualModel } = await attempt(temps[i]);
      const parsed: unknown = JSON.parse(rawText); // schema.safeParse cannot fail; JSON.parse can
      const validated = opts.schema.safeParse(parsed);
      if (validated.success) return { ok: true, data: validated.data, actualModel };
      // .catch()-everywhere means this is unreachable, but stay defensive:
      if (i === 0) opts.onWarning("The model returned something unusable — retrying.");
    } catch (err: unknown) {
      // The adapter owns every vendor-specific error shape; this branch only
      // knows the four kinds, so a new provider never means editing the route.
      lastDetail = err instanceof Error ? err.message : String(err);
      const { kind, retryAfterSeconds } = opts.provider.classifyError(err);
      if (kind === "auth") return { ok: false, reason: "auth" };
      // A retired or unknown model fails identically on every retry, so return
      // immediately rather than burning the retry and reporting it as transient.
      if (kind === "model_gone") return { ok: false, reason: "model_gone" };
      if (kind === "rate_limit" && i === 0) {
        if (retryAfterSeconds !== undefined && retryAfterSeconds > 0 && retryAfterSeconds <= 20) {
          opts.onWarning(`${opts.provider.label} is busy — pausing ${retryAfterSeconds}s, then retrying.`);
          await new Promise((r) => setTimeout(r, retryAfterSeconds * 1000));
          continue;
        }
        return { ok: false, reason: "failed" };
      }
      if (i === 0) {
        // Naming the cause matters: an unexplained "failed" hid a model
        // returning empty output for an entire debugging session.
        const why = err instanceof Error ? err.message : String(err);
        opts.onWarning(`A model call failed — retrying once. (${why.slice(0, 160)})`);
      }
    }
  }
  return { ok: false, reason: "failed", detail: lastDetail };
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // x-groq-api-key is the pre-abstraction header name. A browser holding a
  // cached bundle keeps working until it reloads.
  const apiKey = req.headers.get("x-provider-api-key") ?? req.headers.get("x-groq-api-key");
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json<ApiError>(
      { error: "API key required. Add one in Settings.", code: "INVALID_KEY" },
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

  // A request arriving with only the legacy header predates provider support,
  // so it is a Groq request regardless of what the default is now.
  const legacyGroqOnly = !req.headers.get("x-provider-api-key") && !body.provider;
  const provider =
    resolveProvider(body.provider) ?? (legacyGroqOnly ? PROVIDERS.groq : PROVIDERS[DEFAULT_PROVIDER]);

  const model = body.model ?? provider.defaultModel;
  if (!provider.models.some((m) => m.id === model)) {
    return NextResponse.json<ApiError>(
      {
        error: `${provider.label} does not offer "${model}". Pick a different model in Settings.`,
        code: "INVALID_REQUEST",
      },
      { status: 400 }
    );
  }

  // Clips are a provider property: they exist to fit a free-tier ceiling.
  const resumeText = body.resume_text.slice(0, provider.budgets.resumeChars);
  // Requirements-aware clip: long postings keep their requirements section
  // instead of losing it to head-truncation.
  const jdText = clipJd(body.job_description, provider.budgets.jdChars);

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
          provider, apiKey: apiKey.trim(), model, systemPrompt: JD_SKILLS_PROMPT,
          userPrompt: buildJdSkillsUserPrompt(jdText),
          schema: JdSkillsSchema, maxTokens: provider.budgets.maxOutputTokens.jdSkills, onWarning: warn,
        });
        const errorsPromise = callStage({
          provider, apiKey: apiKey.trim(), model, systemPrompt: LINE_AUDIT_PROMPT,
          userPrompt: buildLineAuditUserPrompt(
            buildSectionizedText(structured),
            sectionNames(structured),
            provider.budgets.maxErrors,
            jdText.slice(0, provider.budgets.jdContextChars)
          ),
          schema: LineErrorsSchema, maxTokens: provider.budgets.maxOutputTokens.lineAudit, onWarning: warn,
        });

        const jdOutcome = await jdPromise;
        emit("stage", { stage: "errors", progress: 50 });
        const errorsOutcome = await errorsPromise;
        emit("stage", { stage: "scoring", progress: 70 });

        if (
          (!jdOutcome.ok && jdOutcome.reason === "auth") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "auth")
        ) {
          emit("error", { error: `Invalid ${provider.label} API key. Check your key and try again.`, code: "INVALID_KEY" });
          controller.close();
          return;
        }
        if (
          (!jdOutcome.ok && jdOutcome.reason === "model_gone") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "model_gone")
        ) {
          emit("error", {
            error: `${provider.label} no longer serves "${model}", so it cannot run an analysis. Pick a different model in Settings.`,
            code: "INVALID_REQUEST",
          });
          controller.close();
          return;
        }
        if (!jdOutcome.ok && !errorsOutcome.ok) {
          // Quota exhaustion and a genuine model failure both land here, and
          // they need opposite responses from the user, so name the cause.
          const detail = (!jdOutcome.ok && jdOutcome.detail) || (!errorsOutcome.ok && errorsOutcome.detail) || "";
          const quota = /rate.?limit|quota|429|tokens per day|requests per day|TPD|RPD/i.test(detail);
          emit("error", {
            error: quota
              ? `You've hit ${provider.label}'s rate or daily quota limit, so no model call could complete. Free-tier quotas reset on a daily cycle — wait and retry, or switch provider in Settings. (${detail.slice(0, 200)})`
              : `The model couldn't complete the analysis, even after retries. Try again in a minute, or switch models in Settings.${detail ? ` (${detail.slice(0, 200)})` : ""}`,
            code: quota ? "RATE_LIMITED" : "UNKNOWN",
          });
          controller.close();
          return;
        }

        const jd: JdSkills = jdOutcome.ok
          ? jdOutcome.data
          : { job_title: "", must_have: [], nice_to_have: [], requirements: [], jd_quality: "sparse" };
        if (!jdOutcome.ok) warn("Couldn't extract skills from the job description this run — the Skills tab will be empty.");

        const errors = errorsOutcome.ok ? errorsOutcome.data.errors : [];
        const rawRoles = errorsOutcome.ok ? errorsOutcome.data.roles : [];
        if (!errorsOutcome.ok) warn("The writing audit didn't complete — no line issues are shown, and grammar/impact scores assume none.");

        const roles = segmentRoles(structured, rawRoles);
        // Only anchored roles carry text, so only they can evidence a skill.
        // Passing unanchored ones would rate every match "weak" on no evidence.
        const anchoredRoles = roles.filter((r) => r.anchored);
        if (errorsOutcome.ok && anchoredRoles.length === 0) {
          warn("Couldn't locate your job entries in the resume text — skills are matched without recency this run.");
        }
        // Work-history metrics feed both Gate 2's years check and the
        // competitiveness signals. Anchoring only decides whether a role has
        // TEXT to evidence a skill against — it says nothing about whether
        // the role's dates parsed, and segmentRoles fills in `range` for
        // unanchored roles too. Building dates from anchoredRoles alone would
        // compute total experience from a subset of the roles while
        // hasDatedRoles stayed true, letting the years check report a
        // confident fail off incomplete data. Dates come from ALL roles.
        const datedRanges = roles
          .map((r) => r.range)
          .filter((r) => r.start !== null && r.end !== null);
        // True only when every reported role's dates parsed — a fail the
        // years check reports on a subset isn't a fail, see funnel.ts.
        const datedRolesComplete = datedRanges.length === roles.length;
        const workMetrics = computeWorkHistoryMetrics(datedRanges);
        const skillOpts = { structured, roles: anchoredRoles };
        // "No Kubernetes experience required" must not register as a requirement.
        // This runs here rather than in the zod transform because the transform
        // has no access to the job-description text.
        const notNegated = (name: string) => !isNegatedInJd(name, jdText);

        // Stage 4 — deterministic matching + scoring (code)
        const mustHave = buildSkills(jd.must_have.filter(notNegated), resumeText, skillOpts);
        const niceToHave = buildSkills(jd.nice_to_have.filter(notNegated), resumeText, skillOpts);
        // A posting the model called rich or moderate should yield requirements.
        // Zero here means they were extracted and then dropped downstream —
        // worth saying, because the Skills tab just looks empty otherwise.
        if (jdOutcome.ok && jd.jd_quality !== "sparse" && mustHave.length === 0 && niceToHave.length === 0) {
          warn("The job description parsed, but no usable requirements came out of it — the Skills tab will be empty this run.");
        }
        // A skill the posting explicitly says it does NOT require is a genuine
        // bonus (resume has it, job doesn't need it) — the same negation filter
        // used for mustHave/niceToHave must apply here too, or a negated term
        // stays in the list and silently suppresses its own bonus surfacing.
        const bonusSkills = extractBonusSkills(structured, [
          ...jd.must_have.filter(notNegated),
          ...jd.nice_to_have.filter(notNegated),
        ]);
        const scoring = computeScores({
          errors, formattingAudit: audit, parseWarningCount: structured.warnings.length,
        });
        const funnel = buildFunnel({
          structured, audit, resumeText,
          requirements: jd.requirements,
          mustHave, metrics: workMetrics,
          hasDatedRoles: datedRanges.length > 0,
          datedRolesComplete,
        });
        // The verdict is derived from the gates now — it cannot outlive the
        // overall score it used to be bracketed from.
        const verdict = deriveFunnelVerdict(funnel);

        // Stage 5 — AI-3 summary from a compact factual digest
        emit("stage", { stage: "summary", progress: 85 });
        const sc = scoring.scorecard;
        const missingMust = mustHave.filter((s) => s.match_strength === "missing").map((s) => s.name);
        const auditCount = AUDIT_KEYS.reduce((n, k) => n + audit[k].length, 0);
        const digest = [
          `Job title: ${jd.job_title || "unknown"}`,
          `JD quality: ${jd.jd_quality}`,
          `Gate 1 — Parse: ${funnel.parse.verdict}${funnel.parse.reasons.length > 0 ? ` (${funnel.parse.reasons.slice(0, 3).join("; ")})` : ""}`,
          `Gate 2 — Knockout: ${funnel.knockout.stated ? funnel.knockout.verdict : "the posting states no hard requirements, so nothing was checked"}`,
          `Knockout checks: ${funnel.knockout.checks.slice(0, 6).map((c) => `${c.type} = ${c.verdict}${c.required ? "" : " (preferred, not a knockout)"} — ${c.detail}`).join(" | ") || "none"}`,
          `Gate 3 — Retrieve: surfaces for ${funnel.retrieve.surfaced} of ${funnel.retrieve.total} recruiter searches`,
          `Searches that miss: ${funnel.retrieve.misses.slice(0, 6).join(", ") || "none"}`,
          `Competitiveness signals: ${funnel.signals.map((s) => `${s.label} = ${s.value}`).join("; ") || "none"}`,
          `Missing must-have skills: ${missingMust.join(", ") || "none"}`,
          `Bonus skills on resume: ${bonusSkills.slice(0, 6).join(", ") || "none"}`,
          `Writing errors: ${errors.length} (${errors.filter((e) => e.severity === "critical").length} critical)`,
          `Top errors: ${errors.slice(0, 5).map((e) => `${e.error_type}: ${e.reason}`).join("; ") || "none"}`,
          `Formatting inconsistencies: ${auditCount}`,
          `Writing scores — impact ${sc.impact_score.score}, grammar ${sc.grammar_score.score}, formatting ${sc.formatting_score.score}`,
          `Overall verdict: ${verdict}`,
        ].join("\n");

        const summaryOutcome = await callStage({
          provider, apiKey: apiKey.trim(), model, systemPrompt: SUMMARY_PROMPT,
          userPrompt: buildSummaryUserPrompt(digest),
          schema: SummarySchema, maxTokens: provider.budgets.maxOutputTokens.summary, onWarning: warn,
        });

        const fallback = buildFallbackSummary({
          scorecard: scoring.scorecard, verdict, funnel, mustHave, errors, bonusSkills,
        });
        const summary =
          summaryOutcome.ok && summaryOutcome.data.headline
            ? {
                verdict,
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
          },
          errors,
          formatting_audit: audit,
          ats_extraction: atsExtraction,
          funnel,
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
