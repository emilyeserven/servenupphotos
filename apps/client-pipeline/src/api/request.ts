import { type ErrorBody, apiErrorOf } from "@/api/errors";

/**
 * Sends a request to the pipeline's API and reads its JSON answer. A failed request becomes an
 * error carrying the backend's message, so the user sees why, and GitHub's answer when a GitHub
 * call is what failed.
 */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!res.ok) throw apiErrorOf(url, res.status, json);
  return json as T;
}

/** POSTs `body` as JSON to `url` and reads the JSON answer. */
export function post<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** POSTs `form` as multipart form data to `url`, such as a photo to read, and reads the JSON answer. */
export function postForm<T>(url: string, form: FormData): Promise<T> {
  return requestJson<T>(url, { method: "POST", body: form });
}

/** A binary answer from the pipeline's API, such as a resized version, with the answer's headers. */
export interface BlobResponse {
  blob: Blob;
  headers: Headers;
}

/**
 * Sends a request to the pipeline's API and reads its answer as a Blob. A failed request becomes
 * the same error as `requestJson`'s, read from the backend's JSON error body.
 */
export async function requestBlob(url: string, init?: RequestInit): Promise<BlobResponse> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as ErrorBody | null;
    throw apiErrorOf(url, res.status, json);
  }
  return { blob: await res.blob(), headers: res.headers };
}
