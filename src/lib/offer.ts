// The offer, as data. One module so the landing page, and anything later that
// restates it, read the same words. `basis` is not decoration: it names what
// in the product produces the item, which is what stops a bonus from being
// advertised before it exists.
export interface OfferItem {
  slot: string;
  name: string;
  blurb: string;
  /** What actually computes this. Empty is not allowed — see offer.test.ts. */
  basis: string;
  /**
   * False for anything not yet built. Advertising a feature a visitor cannot
   * use is the first drift between page and product — the exact risk a
   * separate marketing surface introduces. Announcing a roadmap is honest;
   * implying it ships today is not.
   */
  available: boolean;
}

export interface Guarantee {
  name: string;
  body: string;
}

export const OFFER_ITEMS: OfferItem[] = [
  {
    slot: "Main",
    name: "The Screening Report",
    blurb:
      "Whether this résumé survives screening for this posting: does it parse, does it meet the stated requirements, would a recruiter's search surface it.",
    basis: "src/lib/funnel.ts — three gates, computed",
    available: true,
  },
  {
    slot: "Bonus A",
    name: "The ATS X-Ray",
    blurb:
      "Exactly what a parser pulls out of your document, and what it silently drops on the way.",
    basis: "src/lib/ats-extract.ts, src/lib/formatting-audit.ts",
    available: true,
  },
  {
    slot: "Bonus B",
    name: "The Human Read",
    blurb:
      "The patterns readers associate with generated text, quoted line by line. Named markers, never a verdict about whether you wrote it.",
    basis: "Phase 4 — deterministic marker library",
    available: false,
  },
  {
    slot: "Bonus C",
    name: "The Posting Decoder",
    blurb:
      "We grade the employer: padding, a missing salary band, ghost-job language, and experience demands older than the technology itself.",
    basis: "Phase 4 — extends AI-1 requirement extraction",
    available: false,
  },
  {
    slot: "Bonus D",
    name: "The Ambush Kit",
    blurb:
      "The interview questions your résumé invites — the gap, the short tenure, the skill you list but never evidence.",
    basis: "src/lib/funnel.ts competitiveness signals",
    available: true,
  },
];

export const GUARANTEES: Guarantee[] = [
  {
    name: "Derived, never invented.",
    body:
      "Every number here is computed from your document and the posting you paste. Where something cannot be computed, we say so instead of guessing — that is why there is no overall score.",
  },
  {
    name: "We never see your résumé twice.",
    body:
      "Your résumé is read once to build your report and then dropped — we keep no copy of it, and your history never leaves your browser. There is no account, because there is nothing to log into.",
  },
];
