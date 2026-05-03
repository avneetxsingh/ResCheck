import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGroqClient, GROQ_MODEL } from "@/lib/groq";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import type { ApiError, AnalyzeResponse } from "@/types/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  resume_text: z.string().min(100, "Resume text too short"),
  job_description: z.string().min(50, "Job description too short"),
  model: z.string().optional(),
  system_prompt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Extract API key from header
  const apiKey = req.headers.get("x-groq-api-key");
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json<ApiError>(
      { error: "Groq API key required. Pass it via the x-groq-api-key header.", code: "INVALID_KEY" },
      { status: 401 }
    );
  }

  // Validate body
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

    const completion = await groq.chat.completions.create({
      model: body.model ?? GROQ_MODEL,
      messages: [
        { role: "system", content: body.system_prompt ?? SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(body.resume_text, body.job_description) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2048,
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      return NextResponse.json<ApiError>(
        { error: "AI returned an empty response.", code: "INVALID_JSON" },
        { status: 422 }
      );
    }

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      return NextResponse.json<ApiError>(
        { error: "AI returned invalid JSON. Please try again.", code: "INVALID_JSON" },
        { status: 422 }
      );
    }

    // Basic shape validation
    if (!result.scorecard || !result.errors || !result.summary || !result.skills_gap) {
      return NextResponse.json<ApiError>(
        { error: "AI response is missing required fields. Please try again.", code: "INVALID_JSON" },
        { status: 422 }
      );
    }

    return NextResponse.json<AnalyzeResponse>({ result });
  } catch (err: unknown) {
    // Groq SDK error handling
    if (err && typeof err === "object") {
      const errObj = err as Record<string, unknown>;
      const status = errObj.status as number | undefined;

      if (status === 401) {
        return NextResponse.json<ApiError>(
          { error: "Invalid Groq API key. Check your key and try again.", code: "INVALID_KEY" },
          { status: 401 }
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
