// Server-side only — do not import from client components
import { createRequire } from "module";
import type { ParsePdfResponse } from "@/types/api";

const require = createRequire(import.meta.url);
// pdf-parse@1.1.1 is pure CJS with no worker setup — safe in Node.js API routes
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
  options?: { max?: number }
) => Promise<{ text: string; numpages: number }>;

// This endpoint is unauthenticated and parses hostile binary input in-process,
// so an unbounded page walk is a free compute lever for a stranger. No résumé
// worth screening runs past 20 pages.
//
// pdf-parse still reports the true numpages, and useAnalysis compares it
// against this number to warn the user when their document was truncated.
// This module is server-only (createRequire), so the client cannot import the
// constant — PARSED_PAGE_LIMIT in useAnalysis.ts mirrors it. Change both.
const MAX_PAGES = 20;

export async function parsePdf(buffer: Buffer): Promise<ParsePdfResponse> {
  const data = await pdfParse(buffer, { max: MAX_PAGES });
  const text = data.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { text, page_count: data.numpages, word_count: wordCount };
}
