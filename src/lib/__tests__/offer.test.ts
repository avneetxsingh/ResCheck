import { describe, it, expect } from "vitest";
import { FREE_RUN_LIMIT } from "../free-run-limit";
import { FREE_RUN_LIMIT as ENFORCED } from "../free-runs";
import { OFFER_ITEMS, GUARANTEES, OUTCOMES, PRIVACY_FACTS, FAQ_ITEMS } from "../offer";
import { SAMPLE_RESULT } from "../sample-result";
import { buildAtsDimensions, summariseChecks } from "../ats-dimensions";
import { MAX_UPLOAD_MB } from "../upload-limit";

describe("the marketing number and the enforced number are the same number", () => {
  // This is the whole point of splitting the constant out. If someone changes
  // the cap in one place, the landing page would otherwise keep advertising
  // the old one — the exact drift a second surface introduces.
  it("free-run limit matches what the meter enforces", () => {
    expect(FREE_RUN_LIMIT).toBe(ENFORCED);
  });
});

describe("offer content", () => {
  it("has one main item and four bonuses", () => {
    expect(OFFER_ITEMS).toHaveLength(5);
    expect(OFFER_ITEMS.filter((i) => i.slot === "Main")).toHaveLength(1);
  });

  it("gives every item a basis and an explicit availability", () => {
    for (const item of OFFER_ITEMS) {
      expect(item.basis.length).toBeGreaterThan(0);
      expect(typeof item.available).toBe("boolean");
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(0);
    }
  });

  it("promises no outcome the product cannot deliver", () => {
    // The spec forbids outcome claims. A blurb that promises interviews or
    // beating an ATS is a defect, not a style choice. The interview clause is
    // deliberately a *promise* pattern, not the bare noun: describing the
    // questions a résumé invites is a description of output, whereas "lands
    // you more interviews" is a result this product cannot produce.
    const banned =
      /\b(land|get|win|score|guarantee)s?\b[^.]{0,24}\binterviews?\b|hired|guarantee[sd]? you|beat the ats|land (a|more)/i;
    for (const item of OFFER_ITEMS) {
      expect(item.blurb).not.toMatch(banned);
    }
  });

  it("catches the outcome promises it exists to catch", () => {
    // Narrowing the interview clause is only safe if it still rejects the
    // phrasings the spec names by example. Pin them.
    const banned =
      /\b(land|get|win|score|guarantee)s?\b[^.]{0,24}\binterviews?\b|hired|guarantee[sd]? you|beat the ats|land (a|more)/i;
    for (const promise of [
      "Land more interviews.",
      "Get you an interview at the company you want.",
      "Beat the ATS every time.",
      "We guarantee you a callback.",
      "Get hired faster.",
    ]) {
      expect(promise).toMatch(banned);
    }
  });

  it("states both guarantees verbatim", () => {
    expect(GUARANTEES).toHaveLength(2);
    expect(GUARANTEES[0].name).toBe("Derived, never invented.");
    expect(GUARANTEES[1].name).toBe("We never see your résumé twice.");
  });

  it("never claims blanket storage-free operation", () => {
    // The app DOES set a signed counter cookie. Guarantee 2 must be about the
    // résumé and the history, never "we store nothing" flat.
    for (const g of GUARANTEES) {
      expect(g.body).not.toMatch(/we store nothing|nothing is stored at all/i);
    }
  });
});

const BANNED_PROMISE =
  /\b(land|get|win|score|guarantee)s?\b[^.]{0,24}\binterviews?\b|hired|guarantee[sd]? you|beat the ats|land (a|more)/i;

describe("outcome copy", () => {
  it("describes output rather than promising a result", () => {
    for (const o of OUTCOMES) {
      expect(o.body).not.toMatch(BANNED_PROMISE);
      expect(o.name).not.toMatch(BANNED_PROMISE);
    }
  });

  it("gives four outcomes, each with a body", () => {
    expect(OUTCOMES).toHaveLength(4);
    for (const o of OUTCOMES) expect(o.body.length).toBeGreaterThan(0);
  });
});

describe("privacy copy", () => {
  // The signed rescheck_free_runs cookie exists, so a blanket "we store
  // nothing" would be false. One of these facts has to name it.
  it("names the one thing that is stored", () => {
    const all = PRIVACY_FACTS.map((f) => `${f.name} ${f.body}`).join(" ").toLowerCase();
    expect(all).toContain("cookie");
  });

  it("never claims the résumé stays on the visitor's machine", () => {
    // It is POSTed to /api/parse-pdf. Claims are scoped to storage, not transit.
    for (const f of PRIVACY_FACTS) {
      expect(`${f.name} ${f.body}`).not.toMatch(/never (leaves|reaches)[^.]{0,20}(your (computer|device)|our servers?)/i);
    }
  });
});

describe("FAQ", () => {
  it("asks at most four questions", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(0);
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(4);
  });

  // The whole product refuses to predict outcomes; the FAQ must not soften it.
  it("answers the guarantee question with a plain no", () => {
    const q = FAQ_ITEMS.find((f) => /guarantee/i.test(f.question));
    expect(q).toBeDefined();
    expect(q!.answer).toMatch(/^no[,.]/i);
  });

  it("states the real upload limit", () => {
    const q = FAQ_ITEMS.find((f) => /file types/i.test(f.question));
    expect(q!.answer).toContain(`${MAX_UPLOAD_MB} MB`);
  });
});

describe("the sample report the landing page advertises", () => {
  // The figures beside the sample are derived from it at render time. Pinning
  // them here means editing the sample cannot quietly change what the page
  // claims, and that the claim stays arithmetic rather than decoration.
  it("passes 25 of 29 checks", () => {
    const tally = summariseChecks(buildAtsDimensions(SAMPLE_RESULT));
    expect(tally.passed).toBe(25);
    expect(tally.total).toBe(29);
    expect(Math.round((tally.passed / tally.total) * 100)).toBe(86);
  });

  it("is not a flawless résumé", () => {
    // A sample where everything passes would be its own kind of dishonesty.
    expect(SAMPLE_RESULT.errors.length).toBeGreaterThan(0);
    expect(SAMPLE_RESULT.summary.top_improvements.length).toBeGreaterThan(0);
    expect(SAMPLE_RESULT.ambush_kit!.questions.length).toBeGreaterThan(0);
    expect(SAMPLE_RESULT.summary.verdict).not.toBe("strong");
  });

  it("keeps an unverifiable knockout unverifiable", () => {
    const checks = SAMPLE_RESULT.funnel!.knockout.checks;
    const auth = checks.find((c) => c.type === "work_authorization");
    expect(auth!.verdict).toBe("unverifiable");
  });
});
