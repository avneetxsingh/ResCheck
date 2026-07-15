import Groq from "groq-sdk";
import { DEFAULT_MODEL } from "./prompts";

export { DEFAULT_MODEL };
export const GROQ_MODEL = DEFAULT_MODEL;

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

export const GROQ_MODELS = [
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", note: "Fastest · default" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", note: "Sharpest audit" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Middle ground" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Slow but thorough" },
];

// Authoritative allowlist — validated in the API route before calling Groq
export const ALLOWED_MODELS = new Set(GROQ_MODELS.map((m) => m.id));
