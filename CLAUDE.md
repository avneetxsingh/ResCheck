@AGENTS.md

## Session Log

### 2026-05-03 — PDF parsing, AI tuning, bug fixes, Settings page

**PDF parsing (resolved):** Went through pdfjs-dist (Turbopack worker issues) → pdf-parse@2 → pdf2json → settled on `pdf-parse@1.1.1` with `createRequire` in the route. `next.config.ts` now sets `serverExternalPackages: ["pdf-parse"]` to prevent Turbopack from bundling it.

**AI model:** Switched from `llama-3.3-70b-versatile` to `llama-3.1-8b-instant` for 10x speed improvement. `max_tokens` dropped from 4096 → 2048. Both defaults live in `src/lib/prompts.ts` as `DEFAULT_MODEL` and are now user-overridable via Settings.

**Bug fixes:**
- `bonus_skills` crash — AI returned objects instead of strings; fixed in `SkillsGapPanel` with defensive coercion and updated prompt to enforce string arrays.
- Nested button HTML error in `HistoryCard` — outer `<button>` converted to `<div role="button">`.

**New: Settings page (`/settings`)**
- Full-page settings UI at `src/app/settings/page.tsx`
- Sections: API key input, model picker (4 Groq models), system prompt editor with reset-to-default, save button, danger zone (clear history / reset all settings)
- API key moved from the inline analyze form to global settings — analyze page now reads from `useSettings`
- Settings icon added to Navbar

**New hook: `useSettings` (`src/hooks/useSettings.ts`)**
- Single source of truth for `{ apiKey, model, systemPrompt }` in localStorage under key `rescheck_settings`
- Migrates old `rescheck_api_key` key on first load, then removes it
- Exposes `saveSettings`, `resetPrompt`, `resetAll`, `hydrated`, `isPromptCustomized`, `isModelCustomized`

**localStorage keys (current):**
- `rescheck_settings` — `{ apiKey, model, systemPrompt }`
- `rescheck_history` — array of up to 20 analysis entries
- `rescheck_api_key` — legacy key, auto-migrated to `rescheck_settings.apiKey` on first load

**Key files (updated):**
- `src/lib/prompts.ts` — system prompt + `DEFAULT_MODEL` constant
- `src/app/api/parse-pdf/route.ts` — pdf-parse@1.1.1 with `createRequire`
- `src/app/api/analyze/route.ts` — Groq analysis, reads model from request body
- `src/hooks/useSettings.ts` — NEW: global settings hook
- `src/app/settings/page.tsx` — NEW: Settings UI
- `src/hooks/useAnalysis.ts` — core orchestration, now reads from `useSettings`
- `next.config.ts` — `serverExternalPackages: ["pdf-parse"]`

**No sync targets:** `gemini.md` and `agents.md` do not exist in this repo (AGENTS.md is the Next.js agent rules file, not a sync target).
