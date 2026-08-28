import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isProviderId } from "@/lib/providers";
import type { Provider } from "@/lib/providers";
import { resolveAnalysisMode } from "@/lib/analysis-mode";
import {
  JD_SKILLS_PROMPT, LINE_AUDIT_PROMPT, SUMMARY_PROMPT,
  buildJdSkillsUserPrompt, buildLineAuditUserPrompt, buildSummaryUserPrompt,
} from "@/lib/prompts";
import { extractResumeStructure, toAtsExtraction, buildSectionizedText, sectionNames } from "@/lib/ats-extract";
import { runFormattingAudit } from "@/lib/formatting-audit";
import { buildSkills, extractBonusSkills, clipJd, sanitizeSkillName, isNegatedInJd } from "@/lib/keyword-match";
import { computeScores, buildFallbackSummary, AUDIT_KEYS } from "@/lib/scoring";
import { analyzeLimiter, clientKey } from "@/lib/rate-limit";
import {
  FREE_RUN_COOKIE, FREE_RUN_LIMIT, freeRunState, serializeFreeRunCookie,
  resolveUsed, encodeRefundToken,
} from "@/lib/free-runs";
import { hostedCapacityBreaker } from "@/lib/circuit-breaker";
import { segmentRoles, computeWorkHistoryMetrics } from "@/lib/work-history";
import {
  buildFunnel, deriveFunnelVerdict, normalizeRequirementType,
  evaluateParseGate, evaluateRetrieveGate,
} from "@/lib/funnel";
import type { ApiError, PartialAnalysis } from "@/types/api";
import type { JdRequirement, RawAnalysisResult } from "@/types/analysis";

export const runtime = "nodejs";
// Measured 2026-08-27 against a live provider: a clean run is ~20s, but a run
// where one stage times out and retries took 67s — past the old 60s ceiling,
// which on Vercel kills the request mid-stream after the visitor has already
// been charged a free run. Worst case is now bounded by STAGE_TIMEOUT_MS:
// AI-1 and AI-2 run in parallel with one retry each, then AI-3, so roughly
// 3 x 2 x 45s. 300 is Vercel's current per-function ceiling.
export const maxDuration = 300;

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

// Per-call ceiling. 25s was too tight for a reasoning model: gpt-oss-120b's
// thinking tokens share the output budget, so the résumé line audit exceeded
// it, aborted, retried, and turned a 20s run into a 67s one — the timeout
// meant as a safety net was itself the cause of the overrun. Measured, not
// guessed; raise this only against a fresh measurement.
const STAGE_TIMEOUT_MS = 45_000;

// ── Stage call: retry once at temp 0.2, rate-limit delay once ──────────────
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
    const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS);
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
        // Carry the detail: the terminal handler regex-tests it to tell a
        // daily-quota exhaustion from a generic failure, and "try again in a
        // minute" is wrong advice for a quota that resets on a daily cycle.
        // Providers return no retry-after on the common 429, so this is the
        // branch a quota-exhausted user actually takes.
        return { ok: false, reason: "failed", detail: lastDetail };
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
  // Ahead of the key check, because everything up to the first provider call
  // is unauthenticated: body parsing, resume-text handling and the whole
  // deterministic extraction run before a key is ever validated.
  const rateKey = clientKey(req.headers);
  if (rateKey) {
    const { allowed, retryAfterSeconds } = analyzeLimiter.check(rateKey);
    if (!allowed) {
      return NextResponse.json<ApiError>(
        {
          error: `Too many analyses from this connection. Wait about ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"} and try again.`,
          code: "RATE_LIMITED",
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }

  // Two modes. A request carrying a key is a Power User: unmetered, and it
  // picks its own provider and model because it is paying for them. A request
  // with no key runs on our key, and therefore chooses nothing — honouring a
  // client-supplied model here would let a stranger point our key at the most
  // expensive model on offer.
  const byoKey = (req.headers.get("x-provider-api-key") ?? req.headers.get("x-groq-api-key"))?.trim() ?? "";
  const usingHosted = byoKey.length === 0;

  const hostedKey = process.env.HOSTED_PROVIDER_API_KEY?.trim() ?? "";
  const freeRunSecret = process.env.FREE_RUN_SECRET?.trim() ?? "";

  let hostedRunsUsed = 0;
  if (usingHosted) {
    // No secret means we cannot meter, and running unmetered on our own key is
    // the one failure mode with an unbounded bill. Refuse instead.
    if (hostedKey.length === 0 || freeRunSecret.length < 16) {
      return NextResponse.json<ApiError>(
        {
          error: "Free analyses aren't available right now. Add your own API key in Settings to keep going.",
          code: "HOSTED_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    if (hostedCapacityBreaker.isOpen()) {
      // The capacity that failed is ours, not the visitor's — this mirrors
      // the auth-failure message below rather than the "you're out of free
      // analyses" wording, which would blame them for our outage while the
      // rail above may still show runs remaining.
      const retryAfterSeconds = hostedCapacityBreaker.retryAfterSeconds();
      const retryMinutes = Math.ceil(retryAfterSeconds / 60);
      const wait =
        retryAfterSeconds <= 60
          ? `${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"}`
          : `${retryMinutes} ${retryMinutes === 1 ? "minute" : "minutes"}`;
      return NextResponse.json<ApiError>(
        {
          error: `Free analyses aren't working right now — this is on us, not you. Wait about ${wait} and try again, or add your own API key in Settings to keep going.`,
          code: "HOSTED_CAPACITY_EXHAUSTED",
        },
        { status: 503, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // The spec pairs the cookie with a localStorage corroboration, because
    // clearing cookies does not always clear localStorage. resolveUsed takes
    // whichever count is higher — forgeable downward, but the cookie already
    // covers that case, so this only ever tightens enforcement, never
    // loosens it. Shared with both /api/free-runs handlers so the number
    // shown to a visitor is computed the same way as the number enforced.
    const cookieState = freeRunState(req.cookies.get(FREE_RUN_COOKIE)?.value, freeRunSecret);
    const used = resolveUsed(cookieState.used, req.headers.get("x-free-runs-used"));
    const state = { used, remaining: Math.max(0, FREE_RUN_LIMIT - used), exhausted: used >= FREE_RUN_LIMIT };
    if (state.exhausted) {
      return NextResponse.json<ApiError>(
        {
          error: `You've used your ${FREE_RUN_LIMIT} free analyses. Add your own API key in Settings for unlimited runs — it never leaves your browser.`,
          code: "FREE_RUNS_EXHAUSTED",
        },
        { status: 403 }
      );
    }
    hostedRunsUsed = state.used;
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
  const legacyGroqHeaderOnly = !req.headers.get("x-provider-api-key") && !body.provider;

  // Provider/model/key resolution is a pure function (src/lib/analysis-mode.ts)
  // so the hosted path's money-safety property — it can never be pointed at a
  // caller-chosen provider or model — is provable by a unit test rather than
  // only by a live curl against a real key, which this environment lacks.
  const modeResult = resolveAnalysisMode({
    byoKey,
    legacyGroqHeaderOnly,
    bodyProvider: body.provider,
    bodyModel: body.model,
    hostedKey,
    freeRunSecret,
    // Trimmed like hostedKey and freeRunSecret above — an untrimmed trailing
    // newline in a platform env value would fail isProviderId and silently
    // swap the owner's chosen provider for the app default.
    hostedProvider: process.env.HOSTED_PROVIDER?.trim(),
  });
  if (!modeResult.ok) {
    return NextResponse.json<ApiError>({ error: modeResult.error, code: modeResult.code }, { status: modeResult.status });
  }
  const { provider, model, apiKey } = modeResult;

  // Clips are a provider property: they exist to fit a free-tier ceiling.
  const resumeText = body.resume_text.slice(0, provider.budgets.resumeChars);
  // Requirements-aware clip: long postings keep their requirements section
  // instead of losing it to head-truncation.
  const jdText = clipJd(body.job_description, provider.budgets.jdChars);

  // Computed before the stream so both the stream body (which mints the
  // refund token on its terminal error path) and the response headers below
  // (which still set the counter cookie) agree on the same charged-to count.
  const secure = (req.headers.get("x-forwarded-proto") ?? "http") === "https";
  const nextUsed = usingHosted ? hostedRunsUsed + 1 : 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const warnings: string[] = [];
      const emit = (event: string, data: unknown) => controller.enqueue(sse(event, data));
      const warn = (message: string) => {
        warnings.push(message);
        emit("warning", { message });
      };
      // The only place a refund token is minted. Every reachable error exit
      // from this point on corresponds to a run the response headers already
      // charged (Set-Cookie commits before this stream body runs), so every
      // one of them gets a token; the `result` path never calls this, so a
      // successful run has nothing to replay.
      const emitError = (data: { error: string; code: string }) => {
        emit("error", usingHosted ? { ...data, refund_token: encodeRefundToken(nextUsed, freeRunSecret) } : data);
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
          provider, apiKey, model, systemPrompt: JD_SKILLS_PROMPT,
          userPrompt: buildJdSkillsUserPrompt(jdText),
          schema: JdSkillsSchema, maxTokens: provider.budgets.maxOutputTokens.jdSkills, onWarning: warn,
        });
        const errorsPromise = callStage({
          provider, apiKey, model, systemPrompt: LINE_AUDIT_PROMPT,
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

        // Two of the three gates are final the moment AI-1 lands, and AI-2 can
        // take another 15-80s (measured 2026-08-27). Holding a finished answer
        // back for a stage it does not depend on is just making the user wait.
        //
        // Only these two. Gate 2 needs work history, which comes out of AI-2 —
        // see PartialAnalysis for why a partial knockout would be a fabricated
        // answer rather than an early one.
        if (jdOutcome.ok) {
          const earlyJd = jdOutcome.data;
          const earlyMustHave = earlyJd.must_have.filter((n) => !isNegatedInJd(n, jdText));
          emit("partial", {
            parse: evaluateParseGate(structured, audit),
            retrieve: evaluateRetrieveGate(earlyMustHave, resumeText),
            ats_extraction: atsExtraction,
            jd_quality: earlyJd.jd_quality,
          } satisfies PartialAnalysis);
        }

        const errorsOutcome = await errorsPromise;
        emit("stage", { stage: "scoring", progress: 70 });

        if (
          (!jdOutcome.ok && jdOutcome.reason === "auth") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "auth")
        ) {
          // On the hosted path that key is ours, not the visitor's — telling
          // them to check a key they never entered is both wrong and
          // unfixable by them.
          emitError({
            error: usingHosted
              ? "Free analyses aren't working right now — this one's on us, not you. Add your own API key in Settings to keep going."
              : `Invalid ${provider.label} API key. Check your key and try again.`,
            code: usingHosted ? "HOSTED_UNAVAILABLE" : "INVALID_KEY",
          });
          // A revoked or misconfigured hosted key fails identically on every
          // request, so hammering it on every visitor's turn helps nobody.
          if (usingHosted) hostedCapacityBreaker.trip();
          controller.close();
          return;
        }
        if (
          (!jdOutcome.ok && jdOutcome.reason === "model_gone") ||
          (!errorsOutcome.ok && errorsOutcome.reason === "model_gone")
        ) {
          emitError({
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
          // Only the hosted key's exhaustion is ours to remember. A Power
          // User hitting their own quota must never take down the free path
          // for everyone else.
          if (quota && usingHosted) hostedCapacityBreaker.trip();
          emitError({
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
          // "0 errors" reads as a clean resume; when the audit failed it means
          // nothing was looked at. AI-3 must not narrate the difference away.
          errorsOutcome.ok
            ? `Writing errors: ${errors.length} (${errors.filter((e) => e.severity === "critical").length} critical)`
            : "Writing audit: DID NOT RUN this time. Say so plainly; do not describe the writing as clean or claim anything about wording.",
          `Top errors: ${errors.slice(0, 5).map((e) => `${e.error_type}: ${e.reason}`).join("; ") || "none"}`,
          `Formatting inconsistencies: ${auditCount}`,
          `Writing scores — impact ${sc.impact_score.score}, grammar ${sc.grammar_score.score}, formatting ${sc.formatting_score.score}`,
          `Overall verdict: ${verdict}`,
        ].join("\n");

        const summaryOutcome = await callStage({
          provider, apiKey, model, systemPrompt: SUMMARY_PROMPT,
          userPrompt: buildSummaryUserPrompt(digest),
          schema: SummarySchema, maxTokens: provider.budgets.maxOutputTokens.summary, onWarning: warn,
        });

        const fallback = buildFallbackSummary({
          scorecard: scoring.scorecard, verdict, funnel, mustHave, errors, bonusSkills,
          writingAuditRan: errorsOutcome.ok,
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
        emitError({ error: "Analysis failed. Please try again.", code: "UNKNOWN" });
        controller.close();
      }
    },
  });

  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  if (usingHosted) {
    // Set-Cookie can only be sent with the response headers, which are
    // written before the SSE body streams — so the run is charged up front.
    // The refund token is NOT set here: at this point the server does not
    // yet know whether the run will succeed, and a token minted for a run
    // that goes on to succeed would have nothing legitimate to prove. It is
    // minted only from inside the stream, on the terminal error path.
    responseHeaders.append("Set-Cookie", serializeFreeRunCookie(nextUsed, freeRunSecret, secure));
    responseHeaders.set("X-Free-Runs-Remaining", String(Math.max(0, FREE_RUN_LIMIT - nextUsed)));
  }

  return new Response(stream, { headers: responseHeaders });
}
