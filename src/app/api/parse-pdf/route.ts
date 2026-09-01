import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf-parser";
import { clientKey, parsePdfLimiter } from "@/lib/rate-limit";
import type { ApiError } from "@/types/api";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// The cap and the number in the message below come from one constant so they
// cannot disagree; see upload-limit.ts for why that mattered.

export async function POST(req: NextRequest) {
  // Before anything expensive: this route is unauthenticated and hands
  // hostile binary input to a PDF parser in-process, which makes it the
  // cheapest lever a stranger has on the deployer's compute.
  const key = clientKey(req.headers);
  if (key) {
    const { allowed, retryAfterSeconds } = parsePdfLimiter.check(key);
    if (!allowed) {
      return NextResponse.json<ApiError>(
        {
          error: `Too many uploads from this connection. Wait about ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"} and try again.`,
          code: "PARSE_FAILED",
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }

  // Without this, a request carrying no multipart body throws inside
  // formData() and lands in the generic 500 branch — recording a client
  // mistake as a server fault and masking real 5xx once this is public.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json<ApiError>(
      { error: "Upload the PDF as a file attachment.", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("resume");

    if (!file || !(file instanceof File)) {
      return NextResponse.json<ApiError>(
        { error: "No PDF file provided. Use field name 'resume'.", code: "PARSE_FAILED" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json<ApiError>(
        { error: "Only PDF files are supported.", code: "PARSE_FAILED" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json<ApiError>(
        {
          error: `File too large. Maximum size is ${MAX_UPLOAD_MB} MB.`,
          code: "PARSE_FAILED",
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parsePdf(buffer);

    if (!result.text || result.text.length < 50) {
      return NextResponse.json<ApiError>(
        { error: "This PDF has no readable text — it's probably a scan or an image export. Re-export it from your editor as a text PDF.", code: "PARSE_FAILED" },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[parse-pdf]", err);
    return NextResponse.json<ApiError>(
      { error: "Couldn't read this PDF. Re-export it and try again.", code: "PARSE_FAILED" },
      { status: 500 }
    );
  }
}
