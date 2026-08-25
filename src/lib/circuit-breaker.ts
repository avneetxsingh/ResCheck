// Stops us asking a provider for capacity it has already refused.
//
// Same honesty caveat as rate-limit.ts: this is in-process, so N warm
// serverless instances hold N independent breakers. It exists to stop one
// instance hammering an exhausted quota, not to be a global authority — the
// global bound is the spend limit configured on the key at the provider.
export class CircuitBreaker {
  private openUntil = 0;

  constructor(private readonly cooldownMs: number) {}

  trip(now: number = Date.now()): void {
    this.openUntil = now + this.cooldownMs;
  }

  isOpen(now: number = Date.now()): boolean {
    return now < this.openUntil;
  }

  retryAfterSeconds(now: number = Date.now()): number {
    if (!this.isOpen(now)) return 0;
    // Always at least 1: a Retry-After of 0 invites an immediate retry.
    return Math.max(1, Math.ceil((this.openUntil - now) / 1000));
  }

  reset(): void {
    this.openUntil = 0;
  }
}

// Ten minutes: long enough that a quota-exhausted minute is not retried into
// the ground, short enough that a transient overload clears without a deploy.
export const hostedCapacityBreaker = new CircuitBreaker(10 * 60_000);
