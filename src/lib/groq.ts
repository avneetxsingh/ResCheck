import Groq from "groq-sdk";
import { DEFAULT_MODEL } from "./prompts";

export { DEFAULT_MODEL };
export const GROQ_MODEL = DEFAULT_MODEL;

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

// Groq retires model IDs on a rolling basis and a dead ID fails every call.
// llama-3.1-8b-instant and llama-3.3-70b-versatile were shut down 2026-08-16;
// these two are the only production text models left. Check
// console.groq.com/docs/deprecations before adding or trusting an ID here.
export const GROQ_MODELS = [
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Fastest · default" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Slower · sharpest audit" },
];

// Authoritative allowlist — validated in the API route before calling Groq
export const ALLOWED_MODELS = new Set(GROQ_MODELS.map((m) => m.id));
