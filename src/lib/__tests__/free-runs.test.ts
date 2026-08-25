import { describe, it, expect } from "vitest";
import {
  FREE_RUN_LIMIT,
  FREE_RUN_COOKIE,
  encodeFreeRuns,
  decodeFreeRuns,
  freeRunState,
  serializeFreeRunCookie,
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
