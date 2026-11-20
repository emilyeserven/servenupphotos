import { type ErrorBody, apiErrorOf } from "@/api/errors";

/**
 * Sends a request to the pipeline's API and reads its JSON answer. A failed request becomes an
 * error carrying the backend's message, so the user sees why, and GitHub's answer when a GitHub
 * call is what failed.
 */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await requestJsonResponse<T>(url, init)).data;
}

/** A JSON answer from the pipeline's API, with the answer's headers. */
export interface JsonResponse<T> {
  data: T;
  headers: Headers;
}

/** Sends a request like `requestJson`, and gives the answer's headers with its JSON. */
export async function requestJsonResponse<T>(
  url: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!res.ok) throw apiErrorOf(url, res.status, json);
  return { data: json as T, headers: res.headers };
}

/** Sends `body` as JSON to `url` with `method` and reads the JSON answer. */
function sendJson<T>(method: string, url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** POSTs `body` as JSON to `url` and reads the JSON answer. */
export function post<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>("POST", url, body);
}

/** PUTs `body` as JSON to `url`, such as a file to save in place, and reads the JSON answer. */
export function put<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>("PUT", url, body);
}

/**
 * Sends a DELETE to `url` and reads the JSON answer. With `body`, it goes as JSON, for the few
 * deletes that say more than their URL does.
 */
export function del<T>(url: string, body?: unknown): Promise<T> {
  return body === undefined
    ? requestJson<T>(url, { method: "DELETE" })
    : sendJson<T>("DELETE", url, body);
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
