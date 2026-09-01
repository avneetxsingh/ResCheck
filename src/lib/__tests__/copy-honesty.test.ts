import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// The résumé is POSTed to /api/parse-pdf and a Power User's key travels to
// /api/analyze as the x-provider-api-key header. Public copy may therefore
// promise that nothing is *stored*, never that nothing is *sent*. This has been
// got wrong three times; the guard is cheaper than the fourth review.
const TRANSIT_CLAIMS = [
  /never\s+reaches\s+our\s+servers?/i,
  /never\s+sent\s+to\s+our\s+servers?/i,
  /does\s+not\s+reach\s+our\s+servers?/i,
  /never\s+touches\s+our\s+servers?/i,
];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !full.includes("__tests__")) acc.push(full);
  }
  return acc;
}

describe("public copy", () => {
  it("never claims data does not reach our server", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      const text = fs.readFileSync(file, "utf8");
      for (const claim of TRANSIT_CLAIMS) {
        const m = text.match(claim);
        if (m) offenders.push(`${path.relative(process.cwd(), file)}: "${m[0]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
