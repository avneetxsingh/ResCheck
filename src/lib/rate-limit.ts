// Fixed-window rate limiting for the two unauthenticated API routes.
//
// WHAT THIS IS AND IS NOT. This is an in-process counter. Serverless
// instances do not share memory, so N warm instances allow roughly N times
// the stated budget, and a cold start resets the window. It is a speed bump
// against a casual script, not a wall against a determined attacker — the
// real answer is a firewall rule at the edge (on Vercel: Firewall → Rate
// Limiting), configured at deploy time.
//
// It lives here anyway because the alternative was a hosted limiter, and this
// app deliberately has no backend, no accounts and no server-side secrets.
// Requiring an Upstash account to run your own copy would trade the whole
// architecture for a bound this gets most of the way to for free.

export interface RateLimitResult {
  allowed: boolean;
  // Seconds until the window resets. Only meaningful when allowed is false.
  retryAfterSeconds: number;
}

interface CountWindow {
  count: number;
  resetAt: number;
}

// Bounded so a flood of unique addresses cannot grow the map without limit.
const MAX_TRACKED_KEYS = 10_000;

export class RateLimiter {
  private readonly windows = new Map<string, CountWindow>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const existing = this.windows.get(key);

    if (!existing || now >= existing.resetAt) {
      this.evictIfFull(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count < this.limit) {
      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: false,
      // Always at least 1: a Retry-After of 0 invites an immediate retry.
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  private evictIfFull(now: number): void {
    if (this.windows.size < MAX_TRACKED_KEYS) return;
    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(key);
    }
    // Still full of live windows — drop the oldest insertion, which Map
    // iteration order yields first.
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      const oldest = this.windows.keys().next();
      if (!oldest.done) this.windows.delete(oldest.value);
    }
  }
}

// Returns null when no client address can be determined. Callers skip
// limiting in that case rather than bucketing every such request together,
// which would let one unidentifiable client lock out everyone else.
export function clientKey(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

// Parsing a PDF is the most expensive thing an anonymous caller can trigger,
// so it gets the tighter budget. Analysis is bounded further by the user's
// own provider quota once a key is supplied.
export const parsePdfLimiter = new RateLimiter(10, 60_000);
export const analyzeLimiter = new RateLimiter(20, 60_000);
