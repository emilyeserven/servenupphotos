# R2 errors

How the pipeline handles a request to Cloudflare R2 that fails, and what it shows so the failure can be looked up: the retry in `apps/be-pipeline/internal/storage/retry.go`, the details in `storage/r2.go` (`CloudflareResponse`) and their display in `apps/client-pipeline/src/components/cloudflare-details.tsx`, which every `ErrorNote` shows.

## Asking again

R2 now and then answers a request with a 500 (`InternalError`, which [Cloudflare's error list](https://developers.cloudflare.com/r2/api/error-codes/) says to retry) that works when asked again. So every read (a GET or HEAD, such as reading the Square Thumbnail's crop or listing the bucket) that gets a 5xx or 429 answer is sent up to 3 times, with a short wait between. Nothing else is asked again:

- Uploads, copies and deletes aren't: an upload's body may be a stream that can't be sent twice.
- A connection that never got an answer, or a 4xx such as a wrong key, isn't: it fails the same way every time, so the Settings check still answers at once.

> **Frontend analogy:** it's TanStack Query's `retry`, done once in the backend for every R2 read and only for the server's own hiccups, so a page doesn't need `retry` of its own on these queries.

## What a failure shows

When an R2 request still fails, the backend's error body carries `cloudflare` beside its `message`, and `ErrorNote` shows it under the red message as **Cloudflare's answer**, a summary such as "500 InternalError, after 3 tries" that opens to:

- **Status**, **Code** and **Message**: Cloudflare's HTTP status and S3 error. A HEAD answer has no body, so its code and message are only the status's name ("Internal Server Error").
- **Operation** and **Request**: the S3 call ("HeadObject") and its method and path, bucket then key, so it's clear which object was asked for.
- **Tries**: how many times it was sent, when it was asked again.
- **CF-Ray** and **Request ID**: the IDs Cloudflare support asks for.
- **Pipeline**: the pipeline's own status and `/api` request that failed.
- The whole error as the S3 client reported it, and **Copy details** to paste all of it into an issue.

Any `/api` endpoint that answers with `writeR2Result` and a `*storage.UploadError` carrying `Cloudflare` gets this with no change on the page.
