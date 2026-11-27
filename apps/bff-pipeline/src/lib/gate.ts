/**
 * Spaces out requests to a public server that asks for no more than one request in a while, such
 * as OpenStreetMap's Nominatim: lets one request through per `gapMs`, however many callers wait at
 * once. A gap of 0 lets every request through.
 */
export class Gate {
  #last = -Infinity;

  /** Lets one request through per gapMs; now is the clock, swapped in tests. */
  constructor(
    private readonly gapMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Holds a request until the gap has passed since the last one let through, or until signal
   * aborts, which rejects with the signal's reason. The turn is taken either way, as callers queue
   * behind it.
   */
  async wait(signal?: AbortSignal): Promise<void> {
    const now = this.now();
    const next = Math.max(this.#last + this.gapMs, now);
    this.#last = next;
    signal?.throwIfAborted();
    if (next <= now) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(done, next - now);
      function done() {
        signal?.removeEventListener("abort", aborted);
        resolve();
      }
      function aborted() {
        clearTimeout(timer);
        reject(signal?.reason);
      }
      signal?.addEventListener("abort", aborted, { once: true });
    });
  }
}
