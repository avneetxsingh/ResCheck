// Server-side only — do not import from client components
import { createRequire } from "module";
import type { ParsePdfResponse } from "@/types/api";

const require = createRequire(import.meta.url);
// pdf-parse@1.1.1 is pure CJS — safe in Node.js API routes. It is not, however,
// free of worker setup: see parseWithColdStartRetry below.
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

// pdf-parse flips `PDFJS.disableWorker` on its way into each getDocument, but
// pdf.js v1.10 finishes wiring its stand-in worker asynchronously. Parsing
// races that setup, and the loser rejects a structurally valid PDF with "bad
// XRef entry".
//
// Measured 2026-08-31 against a Chrome-printed one-page résumé whose xref table
// was verified sound by hand — every offset lands on the object it names:
//   · 5/5 failures as the first parse in a fresh process
//   · 2/10 failures across identical uploads to one warm server
//   · 1/6 failures across six renders of the same HTML
// Larger documents usually win the race, which is why a 95KB fixture hid this
// and a 32KB one exposed it. The retry is therefore NOT cold-start-only: an
// earlier version of this fix gated on the first parse per process and still
// failed roughly a fifth of uploads.
//
// Gate 1 is the claim that the document parses, so a spurious failure here
// tells someone their good résumé is broken — the false alarm this product
// exists to refuse. Attempts are independent, so three of them take a ~20%
// failure to under 1%. A genuinely unreadable PDF still fails all three and
// reaches the caller as the honest error.
const PARSE_ATTEMPTS = 3;

async function parseWithWorkerRaceRetry(buffer: Buffer) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PARSE_ATTEMPTS; attempt++) {
    try {
      return await pdfParse(buffer, { max: MAX_PAGES });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function parsePdf(buffer: Buffer): Promise<ParsePdfResponse> {
  const data = await parseWithWorkerRaceRetry(buffer);
  const text = data.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { text, page_count: data.numpages, word_count: wordCount };
}
