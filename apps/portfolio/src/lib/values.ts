/**
 * Small helpers for reading values of unknown shape, such as a photo JSON field or a pasted LLM answer.
 * Both apps share them: the portfolio imports them as `@/lib/values`, the pipeline as `@portfolio/lib/values`.
 */

/** Whether the value is a plain object, such as `{ "x": 1 }`, and not null or an array. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value's text, trimmed, or "" when it isn't text. */
export function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The value's text exactly as written, spaces and line breaks kept, or "" when it isn't text. */
export function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The number kept from low to high, both included. */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
