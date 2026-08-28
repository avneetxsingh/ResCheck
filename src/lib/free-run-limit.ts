// Client-safe on purpose. free-runs.ts imports node:crypto and cannot be
// pulled into a browser bundle, but the landing page has to state this number
// out loud. Splitting it means the sentence a visitor reads and the cap the
// server enforces are the same literal — see offer.test.ts, which fails the
// build if they ever diverge.
// Annotated `number`, not left to infer the literal `2`. Consumers write a
// singular branch (`=== 1 ? "check" : "checks"`) because every count-
// interpolating string in this repo needs one; under a literal type that
// branch is a compile error, which would pressure the next author to delete
// the branch rather than the annotation.
export const FREE_RUN_LIMIT: number = 2;
