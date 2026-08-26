import { NextRequest, NextResponse } from "next/server";
import {
  FREE_RUN_COOKIE,
  FREE_RUN_LIMIT,
  freeRunState,
  serializeFreeRunCookie,
  resolveUsed,
  refundTokenMatches,
} from "@/lib/free-runs";
import { analyzeLimiter, clientKey } from "@/lib/rate-limit";
import type { ApiError, FreeRunsResponse } from "@/types/api";

export const runtime = "nodejs";
export const maxDuration = 60;

function secret(): string | null {
  const s = process.env.FREE_RUN_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

function isSecure(req: NextRequest): boolean {
  return (req.headers.get("x-forwarded-proto") ?? "http") === "https";
}

// A per-visitor counter is the one response an intermediary must never cache
// on this visitor's behalf for the next one.
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// GET — how many hosted runs this visitor has left. Called on page load so the
// meter is honest before the first run rather than after it.
export async function GET(req: NextRequest) {
  const key = secret();
  const hostedConfigured = key !== null && (process.env.HOSTED_PROVIDER_API_KEY?.trim() ?? "").length > 0;
  if (!key || !hostedConfigured) {
    return noStore(NextResponse.json<FreeRunsResponse>({ remaining: 0, limit: FREE_RUN_LIMIT, available: false }));
  }
  // Same corroboration rule /api/analyze enforces with — otherwise this
  // number and the number that actually gets enforced can disagree, and a
  // visitor is shown a count the very next click contradicts.
  const cookieState = freeRunState(req.cookies.get(FREE_RUN_COOKIE)?.value, key);
  const used = resolveUsed(cookieState.used, req.headers.get("x-free-runs-used"));
  return noStore(
    NextResponse.json<FreeRunsResponse>({
      remaining: Math.max(0, FREE_RUN_LIMIT - used),
      limit: FREE_RUN_LIMIT,
      available: true,
    })
  );
}

// POST — refund one run. Called by the client when an analysis it paid for
// terminated in an error. Requires the signed refund token /api/analyze's SSE
// stream emits on its terminal error event (sent here as the x-refund-token
// header): without it, nothing is refunded. That token is the only proof a
// run was ever charged, so a visitor cannot manufacture a refund out of
// nothing — a version that skipped this check let two bare POSTs take any
// visitor from used=2 to used=0 with no charge behind either one.
export async function POST(req: NextRequest) {
  const rateKey = clientKey(req.headers);
  if (rateKey) {
    const { allowed, retryAfterSeconds } = analyzeLimiter.check(rateKey);
    if (!allowed) {
      return NextResponse.json<ApiError>(
        {
          error: `Too many requests from this connection. Wait about ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"} and try again.`,
          code: "RATE_LIMITED",
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }

  const key = secret();
  if (!key) {
    return noStore(NextResponse.json<FreeRunsResponse>({ remaining: 0, limit: FREE_RUN_LIMIT, available: false }));
  }

  const cookieState = freeRunState(req.cookies.get(FREE_RUN_COOKIE)?.value, key);
  const used = resolveUsed(cookieState.used, req.headers.get("x-free-runs-used"));
  const secure = isSecure(req);

  // refundTokenMatches also enforces the token was minted for exactly this
  // used count, not merely that it is validly signed and unexpired — see its
  // doc comment for why that equality is what stops a replayed or
  // wrong-charge token from refunding.
  if (!refundTokenMatches(req.headers.get("x-refund-token"), key, used)) {
    // No valid proof this specific charge happened — report the honest
    // current state and refund nothing. This is the branch a farmed,
    // token-less or replayed POST now hits.
    return noStore(
      NextResponse.json<FreeRunsResponse>({
        remaining: Math.max(0, FREE_RUN_LIMIT - used),
        limit: FREE_RUN_LIMIT,
        available: true,
      })
    );
  }

  const refunded = Math.max(0, used - 1);
  const res = NextResponse.json<FreeRunsResponse>({
    remaining: FREE_RUN_LIMIT - refunded,
    limit: FREE_RUN_LIMIT,
    available: true,
  });
  res.headers.append("Set-Cookie", serializeFreeRunCookie(refunded, key, secure));
  return noStore(res);
}
