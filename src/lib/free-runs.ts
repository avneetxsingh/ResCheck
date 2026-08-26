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

// The client corroborates the cookie with its own localStorage recollection,
// because clearing cookies does not always clear localStorage. The hint can
// only ever raise the enforced count, never lower it — Math.max means a
// visitor cannot use a stale/forged hint to claim fewer runs than the cookie
// already says. /api/analyze and both /api/free-runs handlers must all
// apply this exact rule, or the number a visitor is shown stops matching the
// number that gets enforced against them.
export function resolveUsed(cookieUsed: number, hintedHeader: string | null | undefined): number {
  const hinted = Number(hintedHeader ?? "");
  const hintedUsed = Number.isInteger(hinted) && hinted >= 0 ? Math.min(hinted, FREE_RUN_LIMIT) : 0;
  return Math.max(cookieUsed, hintedUsed);
}

// ── Refund token ────────────────────────────────────────────────────────
// Proof that /api/analyze actually charged a run, so POST /api/free-runs can
// require it instead of being an unauthenticated decrement. Signed and
// separate from the free-run cookie's own signature namespace (the "refund."
// prefix) so a free-run cookie value can never be replayed as a token.
//
// This travels in the SSE stream body (the terminal `error` event), not a
// response header/cookie: headers commit before the stream body runs, so at
// charge time the server does not yet know whether the run will succeed. A
// token minted then would exist even for successful runs, and a successful
// run replaying it would refund a charge that was never a failure. Emitting
// it only from the terminal error event means a successful run never
// receives one, and POST /api/free-runs reads it from the request
// (x-refund-token header) instead of an ambient cookie.
//
// "Single-use" falls out of the chargedTo === used check the caller must
// run: after a refund, `used` drops below chargedTo, so replaying the same
// token against the new state fails that comparison on its own — no separate
// spent-token bookkeeping is needed.
// Long enough to cover a slow stream failure plus the client's own refund
// call; short enough that a saved token cannot mint a run much later.
const REFUND_TOKEN_TTL_SECONDS = 600;

function signRefundToken(chargedTo: number, expiresAt: number, secret: string): string {
  return sign(`refund.${chargedTo}.${expiresAt}`, secret);
}

export function encodeRefundToken(
  chargedTo: number,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const expiresAt = nowSeconds + REFUND_TOKEN_TTL_SECONDS;
  return `${chargedTo}.${expiresAt}.${signRefundToken(chargedTo, expiresAt, secret)}`;
}

// Returns the charged-to count only for a validly signed, unexpired token;
// null otherwise. A null result must refund nothing — that is the whole
// point of the token existing.
export function decodeRefundToken(
  raw: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): number | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [chargedToStr, expiresAtStr, signature] = parts;
  const chargedTo = Number(chargedToStr);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isInteger(chargedTo) || chargedTo < 1 || chargedTo > FREE_RUN_LIMIT) return null;
  if (!Number.isInteger(expiresAt)) return null;
  if (!safeEqual(signature, signRefundToken(chargedTo, expiresAt, secret))) return null;
  if (nowSeconds > expiresAt) return null;
  return chargedTo;
}

// True only when `raw` is a validly signed, unexpired token minted for
// EXACTLY the charge that produced the current `used` count — not merely a
// token that decodes to something. A token minted for an earlier charge
// (chargedTo < used, e.g. the visitor ran and paid for a second analysis
// since) or one replayed after its own refund already landed (used dropped
// below chargedTo) both fail this equality, which is what makes presenting
// the same token twice a no-op without any separate spent-token bookkeeping.
export function refundTokenMatches(
  raw: string | undefined | null,
  secret: string,
  used: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  const chargedTo = decodeRefundToken(raw, secret, nowSeconds);
  return chargedTo !== null && chargedTo === used;
}
