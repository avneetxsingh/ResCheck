// Client-safe on purpose. free-runs.ts imports node:crypto and cannot be
// pulled into a browser bundle, but the landing page has to state this number
// out loud. Splitting it means the sentence a visitor reads and the cap the
// server enforces are the same literal — see offer.test.ts, which fails the
// build if they ever diverge.
export const FREE_RUN_LIMIT = 2;
