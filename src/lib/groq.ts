import Groq from "groq-sdk";
import { DEFAULT_MODEL } from "./prompts";

export { DEFAULT_MODEL };
export const GROQ_MODEL = DEFAULT_MODEL;

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

export const GROQ_MODELS = [
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", note: "Fastest" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", note: "Most accurate" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B", note: "Balanced" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", note: "Long context" },
];
