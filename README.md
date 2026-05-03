# ResCheck — Land the Interview. Beat the Algorithm.

> AI-powered resume optimizer that gives you an ATS score, line-by-line fixes, and a skills gap analysis in seconds — all running in your browser, with your own API key.

---

## The Story

I was applying for jobs and kept getting ghosted. Not because I wasn't qualified — but because my resume wasn't making it past the ATS (Applicant Tracking System) filters that most companies run before a human ever reads anything.

I tried the generic resume checkers online. They were either paywalled, vague ("your resume needs more keywords!"), or built on outdated heuristics. None of them would show me the *exact line* that was wrong and *how to fix it*.

So I built ResCheck. You drop in your resume PDF and the job description, and it comes back with:

- A scored breakdown across 6 dimensions
- Every problematic line, with a suggested rewrite
- A skills gap analysis mapped to must-have vs. nice-to-have requirements
- An executive summary of your strengths and what to fix first

The whole thing runs in under 5 seconds, costs you nothing beyond a free Groq API key, and stores zero data on any server.

---

## What It Does

### ATS Scorecard
Six dimensions, each scored 0–100 with a rationale and one actionable improvement tip:

| Dimension | What it checks |
|---|---|
| **Overall ATS Score** | Holistic pass-rate estimate |
| **Skills Match** | Keyword coverage vs. job description |
| **Grammar & Language** | Tense, voice, clarity |
| **Formatting** | ATS-friendliness of structure |
| **Impact & Quantification** | Whether achievements have numbers |
| **Keyword Density** | Role-specific term frequency |

### Line-by-Line Error Report
Up to 25 flagged lines, each with:
- The verbatim text from your resume
- A suggested rewrite
- Error type (weak verb, passive voice, missing keyword, etc.)
- Severity: critical / moderate / minor
- Section tag: experience, skills, summary, etc.

### Skills Gap Analysis
Every skill in the job description is extracted and matched against your resume:
- **Must-have** vs. **nice-to-have** classification
- `exact` / `partial` / `missing` match strength per skill
- Bonus skills in your resume that stand out even if not required
- Overall match percentage

### Settings
Full control over:
- Your Groq API key (stored locally, never leaves your browser)
- Which model to use (swap between speed and accuracy)
- The system prompt itself — edit the AI's behavior to suit your industry or tone

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) |
| Animations | Framer Motion |
| AI / LLM | [Groq](https://groq.com) — `llama-3.1-8b-instant` (default) |
| PDF Parsing | pdf-parse@1.1.1 (server-side, Node.js) |
| PDF Export | jsPDF + html2canvas |
| Diff View | diff |
| Icons | Lucide React |
| Theming | next-themes |
| Validation | Zod |
| Storage | Browser `localStorage` only — no database |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── analyze/page.tsx          # Main analyze flow
│   ├── history/page.tsx          # Past analyses
│   ├── settings/page.tsx         # Settings panel
│   └── api/
│       ├── parse-pdf/route.ts    # PDF → text (Node.js, server-side)
│       └── analyze/route.ts      # Groq LLM call + response validation
├── components/
│   ├── analyze/                  # Upload form, progress indicator
│   ├── results/                  # Scorecard, error cards, skills gap, diff view
│   ├── history/                  # History list + cards
│   ├── settings/                 # Settings panel
│   └── layout/                   # Navbar, footer, theme provider
├── hooks/
│   ├── useSettings.ts            # Global settings (API key, model, prompt)
│   ├── useAnalysis.ts            # Orchestrates parse → analyze → store
│   ├── useHistory.ts             # localStorage history management
│   └── useExport.ts              # PDF export logic
├── lib/
│   ├── prompts.ts                # System prompt + DEFAULT_MODEL constant
│   ├── groq.ts                   # Groq client + model list
│   └── pdf-parser.ts             # pdf-parse wrapper
└── types/
    ├── analysis.ts               # Full analysis result types
    ├── api.ts                    # API request/response types
    └── history.ts                # History entry type
```

**Data flow:**
```
User uploads PDF + pastes JD
        ↓
POST /api/parse-pdf    →  pdf-parse extracts plain text (server)
        ↓
POST /api/analyze      →  Groq LLM returns structured JSON (server)
        ↓
Client enriches result    adds IDs + timestamps
        ↓
localStorage              history saved, nothing hits a database
```

No database. No user accounts. No telemetry. Everything stays in the browser.

---

## Setup

### Prerequisites
- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys) — takes 30 seconds to get

### 1. Clone and install

```bash
git clone https://github.com/yourusername/rescheck.git
cd rescheck
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Settings** to enter your Groq API key.

No `.env` file needed. The API key is entered in the UI and stored in your browser's `localStorage`.

### 3. Build for production

```bash
npm run build
npm start
```

### 4. Deploy to Vercel (one command)

```bash
npx vercel
```

No environment variables to configure. The app is fully client-driven; the two API routes are stateless and store nothing.

---

## How to Fork and Make It Your Own

### Change the default AI model
Edit `src/lib/prompts.ts`:

```ts
export const DEFAULT_MODEL = "llama-3.3-70b-versatile"; // more accurate, ~3x slower
```

All available models are listed in `src/lib/groq.ts` in the `GROQ_MODELS` array. Add or remove entries to control what appears in the Settings model picker.

### Edit the system prompt
The entire scoring logic lives in `SYSTEM_PROMPT` in `src/lib/prompts.ts`. You can:
- Adjust the scoring rubric (e.g. be harsher below a certain score threshold)
- Change the maximum number of errors reported (currently 25)
- Tune the language for a specific industry
- Change classification labels or severity definitions

Users can also edit the prompt at runtime from the Settings page — changes are saved to `localStorage` and used on every subsequent analysis.

### Add a new scorecard dimension
1. Add the field to `Scorecard` in `src/types/analysis.ts`
2. Add it to the `OUTPUT SCHEMA` in `SYSTEM_PROMPT` in `src/lib/prompts.ts`
3. `ScorecardPanel.tsx` reads all scorecard keys dynamically — it will appear automatically

### Add a database or user accounts
Everything is `localStorage`-only by design. The natural seams for adding persistence:
- `src/hooks/useHistory.ts` — replace the `localStorage` calls with your API
- `src/hooks/useSettings.ts` — same pattern for synced settings
- `src/app/api/analyze/route.ts` — add auth middleware here; it's already a clean server boundary

### Use a different LLM provider
Replace `src/lib/groq.ts` and update `src/app/api/analyze/route.ts`. The route uses the standard OpenAI-compatible chat completions interface — any provider that supports `{ model, messages, response_format, temperature, max_tokens }` is a drop-in.

---

## Key Design Decisions

**Why Groq?**
Speed. `llama-3.1-8b-instant` on Groq returns a full analysis in under 3 seconds. The free tier supports ~30 requests/minute — more than enough for personal use.

**Why no backend or database?**
Resumes contain personal information. The simplest privacy guarantee is to not store anything server-side at all. The two API routes exist only because you can't safely expose an API key from the browser — they're stateless and immediately discard everything they process.

**Why `pdf-parse@1.1.1` and not a newer library?**
Every modern PDF library built on `pdfjs-dist` requires a Web Worker. Turbopack (Next.js's bundler) can't resolve the worker file path in a server-side bundle. `pdf-parse@1.1.1` ships a self-contained Node.js build with no worker setup. It's loaded via `createRequire` and excluded from Turbopack bundling via `serverExternalPackages: ["pdf-parse"]` in `next.config.ts`.

**Why structured JSON output?**
Groq's `response_format: { type: "json_object" }` forces the model to emit valid JSON. Combined with a typed schema in the prompt and TypeScript interfaces on the client, the entire pipeline is end-to-end typed with minimal runtime validation overhead.

---

## Contributing

Pull requests are welcome. Areas that would be great to improve:

- **Scanned PDF support** — image-based PDFs currently return empty text; OCR integration would fix this
- **Multi-line diff context** — the error highlight shows the flagged line in isolation; showing surrounding context would make fixes clearer
- **Prompt versioning** — tracking which prompt version generated each analysis in history would help when comparing runs
- **Export improvements** — the PDF export uses `html2canvas` which is fragile with custom fonts; a proper PDF renderer would be cleaner

---

## License

MIT — do whatever you want with it.

---

*Built out of frustration with black-box resume screeners. If it helps you land an interview, that's the win.*
