import { NextRequest, NextResponse } from "next/server";
import {
  FREE_RUN_COOKIE,
  FREE_RUN_LIMIT,
  freeRunState,
  serializeFreeRunCookie,
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

// GET — how many hosted runs this visitor has left. Called on page load so the
// meter is honest before the first run rather than after it.
export async function GET(req: NextRequest) {
  const key = secret();
  const hostedConfigured = key !== null && (process.env.HOSTED_PROVIDER_API_KEY?.trim() ?? "").length > 0;
  if (!key || !hostedConfigured) {
    return NextResponse.json<FreeRunsResponse>({ remaining: 0, limit: FREE_RUN_LIMIT, available: false });
  }
  const state = freeRunState(req.cookies.get(FREE_RUN_COOKIE)?.value, key);
  return NextResponse.json<FreeRunsResponse>({
    remaining: state.remaining,
    limit: FREE_RUN_LIMIT,
    available: true,
  });
}

// POST — refund one run. Called by the client when an analysis it paid for
// terminated in an error. Refunds can only ever reduce recorded usage, so the
// worst abuse is a visitor farming refunds to reset a cap we already decided
// is soft. That is a better failure than billing someone for our own outage.
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
    return NextResponse.json<FreeRunsResponse>({ remaining: 0, limit: FREE_RUN_LIMIT, available: false });
  }

  const state = freeRunState(req.cookies.get(FREE_RUN_COOKIE)?.value, key);
  const refunded = Math.max(0, state.used - 1);
  const res = NextResponse.json<FreeRunsResponse>({
    remaining: FREE_RUN_LIMIT - refunded,
    limit: FREE_RUN_LIMIT,
    available: true,
  });
  res.headers.set("Set-Cookie", serializeFreeRunCookie(refunded, key, isSecure(req)));
  return res;
}
