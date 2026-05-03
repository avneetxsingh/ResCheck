import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf-parser";
import type { ApiError } from "@/types/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
        { error: "Could not extract meaningful text from this PDF. Try a text-based PDF.", code: "PARSE_FAILED" },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[parse-pdf]", err);
    return NextResponse.json<ApiError>(
      { error: "Failed to parse PDF.", code: "PARSE_FAILED" },
      { status: 500 }
    );
  }
}
