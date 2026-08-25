// SERVER ONLY — imports node:crypto. Never import this from a client component.
//
// The hosted free-run counter. It is a signed cookie and nothing more: a
// visitor who clears cookies gets two more runs, which is accepted (see the
// spec's "soft cap"). The bound that actually protects the bill is the
// provider-side spend ceiling, configured outside this codebase.
import { createHmac, timingSafeEqual } from "node:crypto";

export const FREE_RUN_LIMIT = 2;
export const FREE_RUN_COOKIE = "rescheck_free_runs";

export interface FreeRunState {
  used: number;
  remaining: number;
  exhausted: boolean;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

// timingSafeEqual throws on a length mismatch, and a forged cookie is exactly
// where lengths differ — so the length check has to come first.
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encodeFreeRuns(used: number, secret: string): string {
  const clamped = Math.max(0, Math.min(FREE_RUN_LIMIT, Math.floor(used)));
  const value = String(clamped);
  return `${value}.${sign(value, secret)}`;
}

// Absent, malformed or forged all read as zero runs used. Failing open is
// deliberate: the worst case is one free run we meant to charge for, whereas
// failing closed would lock out a visitor over a cookie we mangled ourselves.
export function decodeFreeRuns(raw: string | undefined | null, secret: string): number {
  if (!raw) return 0;
  const split = raw.lastIndexOf(".");
  if (split <= 0 || split === raw.length - 1) return 0;
  const value = raw.slice(0, split);
  const signature = raw.slice(split + 1);
  if (!safeEqual(signature, sign(value, secret))) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(parsed, FREE_RUN_LIMIT);
}

export function freeRunState(raw: string | undefined | null, secret: string): FreeRunState {
  const used = decodeFreeRuns(raw, secret);
  const remaining = Math.max(0, FREE_RUN_LIMIT - used);
  return { used, remaining, exhausted: remaining === 0 };
}

export function serializeFreeRunCookie(used: number, secret: string, secure: boolean): string {
  const parts = [
    `${FREE_RUN_COOKIE}=${encodeFreeRuns(used, secret)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
