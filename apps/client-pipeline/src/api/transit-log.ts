import { isMapLoading } from "@/api/errors";
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
 * How many times a look-up is asked again while its rail or bus map is still downloading: the
 * backend waits up to 100s each time, so this allows a download of over an hour, the most it may take.
 */
const MAX_LOADING_TRIES = 40;

/**
 * Asks the backend for an OpenStreetMap transit look-up, logging to the browser console when it
 * starts, how long it took and what it found or why it failed, since the public servers can be
 * slow or busy. The backend's terminal logs each server it tried. While a rail or bus map it needs
 * is still downloading the backend stops waiting after a while, so it's asked again until the map
 * is ready; the page shows the download's progress meanwhile (`transitDownloadsQuery`).
 */
export async function transitJson<T>(url: string): Promise<T> {
  const start = performance.now();
  console.info("[transit] asking", url);
  try {
    const answer = await askUntilReady<T>(url, start);
    console.info("[transit]", sizeOf(answer), "in", secondsSince(start), url, answer);
    return answer;
  } catch (error) {
    console.warn("[transit] failed after", secondsSince(start), url, error);
    throw error;
  }
}

/** Asks url, and again each time it stops waiting for a map still downloading, up to the limit. */
async function askUntilReady<T>(url: string, start: number, tries = 1): Promise<T> {
  try {
    return await requestJson<T>(url);
  } catch (error) {
    if (!isMapLoading(error) || tries >= MAX_LOADING_TRIES) throw error;
    console.info("[transit] map still downloading after", secondsSince(start), "asking again", url);
    return askUntilReady<T>(url, start, tries + 1);
  }
}
