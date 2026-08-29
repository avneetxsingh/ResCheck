import { describe, it, expect } from "vitest";
import { isRenderableEntry } from "../history-storage";

// A minimal entry carrying every field AnalysisResult declares non-optional.
// The optional ones (funnel, ats_extraction, formatting_audit, ambush_kit,
// warnings) are deliberately absent: entries stored before those features
// existed lack them and must still be considered renderable.
const valid = {
  id: "a1",
  created_at: "2026-08-29T00:00:00.000Z",
  job_title_hint: "Senior Engineer",
  result: {
    scorecard: {},
    skills_gap: {},
    errors: [],
    summary: {},
    metadata: { model: "m", analyzed_at: "2026-08-29T00:00:00.000Z" },
  },
};

describe("isRenderableEntry", () => {
  it("accepts a well-formed entry", () => {
    expect(isRenderableEntry(valid)).toBe(true);
  });

  it("accepts a legacy entry lacking every optional result field", () => {
    // Invariant 8 in test form: entries stored before a feature existed
    // persist forever and must keep rendering.
    expect(isRenderableEntry(valid)).toBe(true);
    expect("funnel" in valid.result).toBe(false);
    expect("ambush_kit" in valid.result).toBe(false);
  });

  // The exact record that blanked the app: structurally valid JSON whose
  // required sub-objects are null. A component dereferenced one and threw,
  // and with no boundary the whole page unmounted.
  it("rejects an entry whose required result fields are null", () => {
    const corrupt = { ...valid, result: { ...valid.result, scorecard: null } };
    expect(isRenderableEntry(corrupt)).toBe(false);
  });

  it("rejects an entry with no result at all", () => {
    expect(isRenderableEntry({ id: "a", created_at: "x", job_title_hint: "y" })).toBe(false);
  });

  it("rejects entries whose errors field is not an array", () => {
    expect(isRenderableEntry({ ...valid, result: { ...valid.result, errors: {} } })).toBe(false);
  });

  it("rejects an entry missing its id", () => {
    const noId: Record<string, unknown> = { ...valid };
    delete noId.id;
    expect(isRenderableEntry(noId)).toBe(false);
  });

  it("rejects primitives, null and arrays", () => {
    for (const bad of [null, undefined, 42, "entry", [], true]) {
      expect(isRenderableEntry(bad)).toBe(false);
    }
  });

  it("rejects a summary that is present but null", () => {
    expect(isRenderableEntry({ ...valid, result: { ...valid.result, summary: null } })).toBe(false);
  });
});
