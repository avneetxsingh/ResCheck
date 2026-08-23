import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf-parser";
import type { ApiError } from "@/types/api";

export const runtime = "nodejs";
export const maxDuration = 60;

// Under Vercel's ~4.5MB request-body ceiling on purpose: at 5MB the platform
// rejects the upload with a raw 413 before this handler runs, so the user sees
// a bare error instead of the sentence below. ResumeUploader enforces and
// advertises the same number client-side — change all three together.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(req: NextRequest) {
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiError>(
        { error: "File too large. Maximum size is 5MB.", code: "PARSE_FAILED" },
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
