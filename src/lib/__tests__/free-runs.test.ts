import { describe, it, expect } from "vitest";
import {
  FREE_RUN_LIMIT,
  FREE_RUN_COOKIE,
  encodeFreeRuns,
  decodeFreeRuns,
  freeRunState,
  serializeFreeRunCookie,
  resolveUsed,
  encodeRefundToken,
  decodeRefundToken,
  refundTokenMatches,
} from "../free-runs";

const SECRET = "test-secret-value";

describe("encode/decode round trip", () => {
  it("recovers the count it wrote", () => {
    expect(decodeFreeRuns(encodeFreeRuns(0, SECRET), SECRET)).toBe(0);
    expect(decodeFreeRuns(encodeFreeRuns(1, SECRET), SECRET)).toBe(1);
    expect(decodeFreeRuns(encodeFreeRuns(2, SECRET), SECRET)).toBe(2);
  });

  it("clamps a count above the limit when writing", () => {
    expect(decodeFreeRuns(encodeFreeRuns(99, SECRET), SECRET)).toBe(FREE_RUN_LIMIT);
  });

  it("clamps a negative count to zero when writing", () => {
    expect(decodeFreeRuns(encodeFreeRuns(-5, SECRET), SECRET)).toBe(0);
  });
});

describe("decode rejects anything it did not sign", () => {
  it("reads a missing cookie as zero used", () => {
    expect(decodeFreeRuns(undefined, SECRET)).toBe(0);
    expect(decodeFreeRuns(null, SECRET)).toBe(0);
    expect(decodeFreeRuns("", SECRET)).toBe(0);
  });

  it("reads a tampered count as zero used", () => {
    const good = encodeFreeRuns(2, SECRET);
    const tampered = `0.${good.split(".")[1]}`;
    expect(decodeFreeRuns(tampered, SECRET)).toBe(0);
  });

  it("reads a cookie signed with another secret as zero used", () => {
    expect(decodeFreeRuns(encodeFreeRuns(2, "other-secret"), SECRET)).toBe(0);
  });

  it("does not throw on malformed input", () => {
    for (const bad of ["garbage", ".", "1.", ".abc", "1.2.3", "NaN.deadbeef"]) {
      expect(() => decodeFreeRuns(bad, SECRET)).not.toThrow();
      expect(decodeFreeRuns(bad, SECRET)).toBe(0);
    }
  });

  it("does not throw when the signature length differs from a real one", () => {
    expect(decodeFreeRuns("1.short", SECRET)).toBe(0);
  });
});

describe("freeRunState", () => {
  it("reports remaining and exhausted", () => {
    expect(freeRunState(undefined, SECRET)).toEqual({ used: 0, remaining: 2, exhausted: false });
    expect(freeRunState(encodeFreeRuns(1, SECRET), SECRET)).toEqual({ used: 1, remaining: 1, exhausted: false });
    expect(freeRunState(encodeFreeRuns(2, SECRET), SECRET)).toEqual({ used: 2, remaining: 0, exhausted: true });
  });
});

describe("serializeFreeRunCookie", () => {
  it("sets the hardening attributes", () => {
    const c = serializeFreeRunCookie(1, SECRET, true);
    expect(c.startsWith(`${FREE_RUN_COOKIE}=`)).toBe(true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toContain("Secure");
  });

  it("omits Secure when not on https", () => {
    expect(serializeFreeRunCookie(1, SECRET, false)).not.toContain("Secure");
  });
});

describe("resolveUsed", () => {
  it("takes the cookie's count when the hint is absent or lower", () => {
    expect(resolveUsed(2, null)).toBe(2);
    expect(resolveUsed(2, undefined)).toBe(2);
    expect(resolveUsed(2, "1")).toBe(2);
  });

  it("takes the hint when it is higher than the cookie — corroboration only ever tightens", () => {
    expect(resolveUsed(0, "2")).toBe(2);
    expect(resolveUsed(1, "2")).toBe(2);
  });

  it("ignores a malformed, negative or non-integer hint", () => {
    expect(resolveUsed(1, "garbage")).toBe(1);
    expect(resolveUsed(1, "-1")).toBe(1);
    expect(resolveUsed(1, "1.5")).toBe(1);
    expect(resolveUsed(1, "")).toBe(1);
  });

  it("clamps an out-of-range hint to the limit", () => {
    expect(resolveUsed(0, "999")).toBe(FREE_RUN_LIMIT);
  });
});

describe("refund token round trip", () => {
  it("recovers the charged-to count it was issued for", () => {
    const now = 1_000_000;
    const token = encodeRefundToken(1, SECRET, now);
    expect(decodeRefundToken(token, SECRET, now)).toBe(1);
  });

  it("expires after its TTL", () => {
    const now = 1_000_000;
    const token = encodeRefundToken(2, SECRET, now);
    expect(decodeRefundToken(token, SECRET, now + 599)).toBe(2);
    expect(decodeRefundToken(token, SECRET, now + 601)).toBeNull();
  });

  it("rejects a missing token", () => {
    expect(decodeRefundToken(undefined, SECRET)).toBeNull();
    expect(decodeRefundToken(null, SECRET)).toBeNull();
    expect(decodeRefundToken("", SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = encodeRefundToken(1, "other-secret");
    expect(decodeRefundToken(token, SECRET)).toBeNull();
  });

  it("rejects a tampered charged-to value even with a valid-looking signature", () => {
    const token = encodeRefundToken(1, SECRET);
    const parts = token.split(".");
    const tampered = `2.${parts[1]}.${parts[2]}`;
    expect(decodeRefundToken(tampered, SECRET)).toBeNull();
  });

  it("rejects a free-run cookie value presented as a refund token", () => {
    // Different signature namespace ("refund." prefix) — a value signed for
    // one purpose must never validate for the other.
    const freeRunCookieValue = encodeFreeRuns(1, SECRET);
    expect(decodeRefundToken(freeRunCookieValue, SECRET)).toBeNull();
  });

  it("does not throw on malformed input", () => {
    for (const bad of ["garbage", "1.2", "1.2.3.4", "NaN.NaN.deadbeef", "-1.100.abc"]) {
      expect(() => decodeRefundToken(bad, SECRET)).not.toThrow();
      expect(decodeRefundToken(bad, SECRET)).toBeNull();
    }
  });

  it("rejects a charged-to value outside 1..FREE_RUN_LIMIT", () => {
    const zero = encodeRefundToken(0, SECRET);
    expect(decodeRefundToken(zero, SECRET)).toBeNull();
    const tooHigh = encodeRefundToken(FREE_RUN_LIMIT + 1, SECRET);
    expect(decodeRefundToken(tooHigh, SECRET)).toBeNull();
  });
});

describe("refundTokenMatches", () => {
  it("matches a valid token minted for exactly the current used count", () => {
    const token = encodeRefundToken(1, SECRET);
    expect(refundTokenMatches(token, SECRET, 1)).toBe(true);
  });

  it("refuses a token whose charged-to does not match the current used value", () => {
    // Minted for a charge to 1, but presented when used is already back at 0
    // (a replay after refund) or has moved on to 2 (a later charge).
    const token = encodeRefundToken(1, SECRET);
    expect(refundTokenMatches(token, SECRET, 0)).toBe(false);
    expect(refundTokenMatches(token, SECRET, 2)).toBe(false);
  });

  it("is what makes a token single-use: it matches once, then stops matching after the used count it proves has moved", () => {
    const token = encodeRefundToken(2, SECRET);
    expect(refundTokenMatches(token, SECRET, 2)).toBe(true);
    // used drops to 1 after the refund this token justified — the same
    // token presented again no longer matches the new state.
    expect(refundTokenMatches(token, SECRET, 1)).toBe(false);
  });

  it("refuses a forged, expired or malformed token regardless of used", () => {
    expect(refundTokenMatches(encodeRefundToken(1, "other-secret"), SECRET, 1)).toBe(false);
    const now = 1_000_000;
    const expired = encodeRefundToken(1, SECRET, now);
    expect(refundTokenMatches(expired, SECRET, 1, now + 601)).toBe(false);
    for (const bad of ["garbage", "1.2", "1.2.3.4", ""]) {
      expect(refundTokenMatches(bad, SECRET, 1)).toBe(false);
    }
  });

  it("refuses a missing token", () => {
    expect(refundTokenMatches(undefined, SECRET, 1)).toBe(false);
    expect(refundTokenMatches(null, SECRET, 1)).toBe(false);
  });

  it("does not throw on hostile input", () => {
    const hostile = ["garbage", ".", "1.", ".abc", "1.2.3", "NaN.deadbeef", "__proto__.1.x", "1.2.3.4.5"];
    for (const bad of hostile) {
      expect(() => refundTokenMatches(bad, SECRET, 1)).not.toThrow();
      expect(() => decodeRefundToken(bad, SECRET)).not.toThrow();
    }
  });
});
