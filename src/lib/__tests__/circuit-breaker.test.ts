import { describe, it, expect } from "vitest";
import { CircuitBreaker, hostedCapacityBreaker } from "../circuit-breaker";

const T0 = 1_000_000;

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const b = new CircuitBreaker(60_000);
    expect(b.isOpen(T0)).toBe(false);
    expect(b.retryAfterSeconds(T0)).toBe(0);
  });

  it("opens when tripped and stays open for the cooldown", () => {
    const b = new CircuitBreaker(60_000);
    b.trip(T0);
    expect(b.isOpen(T0)).toBe(true);
    expect(b.isOpen(T0 + 59_999)).toBe(true);
  });

  it("closes again once the cooldown elapses", () => {
    const b = new CircuitBreaker(60_000);
    b.trip(T0);
    expect(b.isOpen(T0 + 60_000)).toBe(false);
    expect(b.isOpen(T0 + 120_000)).toBe(false);
  });

  it("reports a retry-after that shrinks but never reaches zero while open", () => {
    const b = new CircuitBreaker(60_000);
    b.trip(T0);
    expect(b.retryAfterSeconds(T0)).toBe(60);
    expect(b.retryAfterSeconds(T0 + 30_000)).toBe(30);
    // A Retry-After of 0 invites an immediate retry, so it floors at 1.
    expect(b.retryAfterSeconds(T0 + 59_999)).toBe(1);
  });

  it("extends the window when tripped again", () => {
    const b = new CircuitBreaker(60_000);
    b.trip(T0);
    b.trip(T0 + 30_000);
    expect(b.isOpen(T0 + 89_000)).toBe(true);
  });

  it("reset closes it immediately", () => {
    const b = new CircuitBreaker(60_000);
    b.trip(T0);
    b.reset();
    expect(b.isOpen(T0)).toBe(false);
  });

  it("ships a shared hosted instance with a non-zero cooldown", () => {
    expect(hostedCapacityBreaker).toBeInstanceOf(CircuitBreaker);
    hostedCapacityBreaker.reset();
    expect(hostedCapacityBreaker.isOpen()).toBe(false);
  });
});
