// Client-safe on purpose, and split out for the same reason as
// free-run-limit.ts: the uploader advertises this number, the uploader enforces
// it before spending an upload, and /api/parse-pdf enforces it again at the
// trust boundary. Three surfaces stating one number is how they drift — the
// route once rejected at 4MB while telling the user the maximum was 5MB, so a
// 4.5MB résumé was refused with a sentence saying it should have been accepted.
// It sits under Vercel's ~4.5MB request-body ceiling deliberately: above that
// the platform returns its own 413 before our handler runs, and the visitor
// gets a raw platform error instead of our sentence.
export const MAX_UPLOAD_MB: number = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
