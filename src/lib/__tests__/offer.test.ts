import { describe, it, expect } from "vitest";
import { FREE_RUN_LIMIT } from "../free-run-limit";
import { FREE_RUN_LIMIT as ENFORCED } from "../free-runs";
import { OFFER_ITEMS, GUARANTEES } from "../offer";

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
