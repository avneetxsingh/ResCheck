// Server-side only — do not import from client components
import { createRequire } from "module";
import type { ParsePdfResponse } from "@/types/api";

const require = createRequire(import.meta.url);
// pdf-parse@1.1.1 is pure CJS with no worker setup — safe in Node.js API routes
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number }>;

export async function parsePdf(buffer: Buffer): Promise<ParsePdfResponse> {
  const data = await pdfParse(buffer);
  const text = data.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { text, page_count: data.numpages, word_count: wordCount };
}
