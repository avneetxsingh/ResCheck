import { MAX_UPLOAD_MB } from "@/lib/upload-limit";

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
    basis: "src/lib/ats-extract.ts, src/lib/formatting-audit.ts, src/lib/column-detect.ts",
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
    basis: "src/lib/ambush-kit.ts — questions derived from computed signals",
    available: true,
  },
];

export const GUARANTEES: Guarantee[] = [
  {
    name: "Derived, never invented.",
    body:
      "Every number here is computed from your document and the posting you paste. The headline figure is a count of the checks we actually ran — not a rating we invented — and the checks nobody could run are left out of it rather than counted against you. Where something cannot be computed, we say so instead of guessing.",
  },
  {
    name: "We never see your résumé twice.",
    body:
      "Your résumé is read once to build your report and then dropped — we keep no copy of it, and your history never leaves your browser. There is no account, because there is nothing to log into.",
  },
];

export interface Outcome {
  /** What the visitor learns, phrased as their gain. */
  name: string;
  /** What produces it. Describes output — never a result we cannot deliver. */
  body: string;
}

// Phrased around the reader rather than the feature, but each is still a
// description of what the report contains. "Know why you were rejected" would
// be the tempting version and a lie: ResCheck never sees the employer's
// decision, only whether the document clears checks it can run.
export const OUTCOMES: Outcome[] = [
  {
    name: "Know what would filter you out",
    body: "Every hard requirement the posting states, checked against your document one at a time.",
  },
  {
    name: "Find the skills your résumé is missing",
    body: "Which of the posting's skills appear in your document, which are absent, and which you list without evidence.",
  },
  {
    name: "See whether recruiters can find you",
    body: "The boolean searches a recruiter would plausibly run, and exactly which ones fail to surface you.",
  },
  {
    name: "Fix the highest-impact issues first",
    body: "Findings ordered by what each one costs you, so the first thing you read is the thing worth changing.",
  },
];

export interface PrivacyFact {
  name: string;
  body: string;
}

// Written against what the code actually does. "We delete your résumé after
// analysis" is the ordinary phrasing and it is weaker than the truth: there is
// no delete step because there is no write. The cookie is named because a
// blanket "we store nothing" would be false.
export const PRIVACY_FACTS: PrivacyFact[] = [
  {
    name: "Read once, never written",
    body: "Your résumé travels over an encrypted connection, is parsed in memory to build your report, and is never written to disk. There is no delete step because there is no save.",
  },
  {
    name: "Nothing to sell",
    body: "No résumé data is sold, shared, or used to train anything — there is none to use. There is no account, and no database behind this.",
  },
  {
    name: "One cookie, no identity",
    body: "A signed cookie counts how many free analyses you have spent, and anonymous counts of pages viewed and analyses run tell us whether the site works. Neither carries a name, an email, or anything from your documents.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is an ATS?",
    answer:
      "An applicant tracking system — the software an employer stores and searches applications in. It is closer to a filing cabinet with a search box than a judge: most of what it does is sort and retrieve, and surveys consistently find it does not auto-reject on résumé content. What does reject automatically is the knockout question on the application form.",
  },
  {
    question: "Do you store my résumé?",
    answer:
      "No. It is parsed in memory to build your report and never written to disk, and your history of past runs stays in your own browser. What is kept on our side is a signed cookie counting your free analyses, plus anonymous counts of pages viewed and analyses run — neither carries an identity, and neither contains anything from your documents.",
  },
  {
    question: "Does a higher figure guarantee an interview?",
    answer:
      "No, and nothing here is a prediction. The figure is a count of the checks this tool ran and how many your document passed — it says whether a machine can read you and whether you match what the posting asked for. Whether a person calls you is not something this or any tool can know.",
  },
  {
    question: "Which file types are supported?",
    answer: `PDF only, up to ${MAX_UPLOAD_MB} MB. A PDF exported from Word, Google Docs or LaTeX parses cleanly; a scan or photo of a printed résumé has no text layer to read, and the app will tell you so rather than guess.`,
  },
];
