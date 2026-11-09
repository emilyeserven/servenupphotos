import { requestJson } from "@/api/request";

/** How many items an answer has, when it's a list, for the log. */
function sizeOf(answer: unknown): string {
  return Array.isArray(answer) ? `${answer.length} found` : "answered";
}

/** Seconds since start, to one decimal place. */
function secondsSince(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(1)}s`;
}

/**
 * Asks the backend for an OpenStreetMap transit look-up, logging to the browser console when it
 * starts, how long it took and what it found or why it failed, since the public servers can be
 * slow or busy. The backend's terminal logs each server it tried.
 */
export async function transitJson<T>(url: string): Promise<T> {
  const start = performance.now();
  console.info("[transit] asking", url);
  try {
    const answer = await requestJson<T>(url);
    console.info("[transit]", sizeOf(answer), "in", secondsSince(start), url, answer);
    return answer;
  } catch (error) {
    console.warn("[transit] failed after", secondsSince(start), url, error);
    throw error;
  }
}
