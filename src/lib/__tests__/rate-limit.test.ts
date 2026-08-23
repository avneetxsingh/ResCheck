import { describe, it, expect } from "vitest";
import { RateLimiter, clientKey } from "@/lib/rate-limit";

const T0 = 1_700_000_000_000;

describe("RateLimiter", () => {
  it("allows requests up to the limit", () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.check("a", T0).allowed).toBe(true);
    expect(rl.check("a", T0 + 1).allowed).toBe(true);
    expect(rl.check("a", T0 + 2).allowed).toBe(true);
  });

  it("rejects the request past the limit", () => {
    const rl = new RateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) rl.check("a", T0 + i);
    expect(rl.check("a", T0 + 3).allowed).toBe(false);
  });

  it("reports how long to wait, never zero", () => {
    const rl = new RateLimiter(1, 60_000);
    rl.check("a", T0);
    const denied = rl.check("a", T0 + 30_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBe(30);

    // A millisecond before the window closes still rounds up to a second, so
    // a client is never told to retry immediately.
    expect(rl.check("a", T0 + 59_999).retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("starts a fresh window once the old one expires", () => {
    const rl = new RateLimiter(2, 60_000);
    rl.check("a", T0);
    rl.check("a", T0);
    expect(rl.check("a", T0 + 100).allowed).toBe(false);
    expect(rl.check("a", T0 + 60_000).allowed).toBe(true);
  });

  it("counts each key separately", () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.check("a", T0).allowed).toBe(true);
    expect(rl.check("b", T0).allowed).toBe(true);
    expect(rl.check("a", T0).allowed).toBe(false);
  });

  it("keeps working past the eviction bound", () => {
    const rl = new RateLimiter(1, 60_000);
    // More unique keys than MAX_TRACKED_KEYS, all inside one window.
    for (let i = 0; i < 10_050; i++) rl.check(`ip-${i}`, T0);
    // A brand new key is still admitted rather than throwing or blocking.
    expect(rl.check("fresh", T0).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("takes the first address from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientKey(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  // Returning null makes the caller skip limiting. Bucketing every
  // unidentifiable request under one key would let a single one lock out
  // everybody else.
  it("returns null when no address is present", () => {
    expect(clientKey(new Headers())).toBeNull();
  });

  it("returns null for a blank header rather than an empty key", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "  " }))).toBeNull();
  });
});
