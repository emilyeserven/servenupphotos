/** One answer kept, and when it was got (ms since the epoch). */
interface Kept<T> {
  value: T;
  at: number;
}

/**
 * Keeps answers from a public server for a while, by question, so asking the same thing again,
 * such as looking up the same area, doesn't ask the server again. Keeps up to `size` answers, each
 * for `ttlMs`.
 */
export class MemoCache<T> {
  readonly #answers = new Map<string, Kept<T>>();

  /** Keeps up to size answers, each for ttlMs; now is the clock, swapped in tests. */
  constructor(
    private readonly ttlMs: number,
    private readonly size: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** The answer kept for key, if it's still fresh. */
  get(key: string): T | undefined {
    const kept = this.#answers.get(key);
    if (!kept || this.#expired(kept)) return undefined;
    return kept.value;
  }

  /** Keeps value as key's answer, first making room by dropping old answers. */
  put(key: string, value: T): void {
    if (this.#answers.size >= this.size) this.#makeRoom();
    this.#answers.set(key, { value, at: this.now() });
  }

  /** Whether the answer is older than the cache keeps answers for. */
  #expired(kept: Kept<T>): boolean {
    return this.now() - kept.at > this.ttlMs;
  }

  /** Drops the expired answers, or the oldest one when none have expired. */
  #makeRoom(): void {
    let oldest: string | undefined;
    let oldestAt = Infinity;
    for (const [key, kept] of this.#answers) {
      if (this.#expired(kept)) this.#answers.delete(key);
      else if (kept.at < oldestAt) [oldest, oldestAt] = [key, kept.at];
    }
    if (this.#answers.size >= this.size && oldest !== undefined) this.#answers.delete(oldest);
  }
}
