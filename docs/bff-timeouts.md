# How long the BFF waits for the backend

The BFF (`apps/bff-pipeline`) relays every `/api/*` request to the Go backend (`src/routes/relay.ts`) and gives up
with a 504 when the backend takes too long. How long it waits for each path comes from the backend itself, so the two
can't drift apart.

## Where the times live

`apps/be-pipeline/internal/httpapi/timeouts.go` keeps `relayTimeouts`: for each path prefix whose work can take longer
than the default 30s, how long the backend may spend on it, written as the sum of the `…Timeout` constants its handler
uses (such as `publishColorsTimeout + publishHashTimeout + publishTimeout` for saving a photo). Work no context bounds,
such as receiving a photo the browser sends, gets an allowance (`photoBodyAllowance`, `photoReadAllowance`).

`GET /timeouts` (`/api/timeouts` through the BFF) answers it in whole seconds:

```json
{
  "defaultSeconds": 30,
  "prefixes": { "/upload": 150, "/data/colors": 300, "/data/progress/": 0, "...": 0 }
}
```

When the BFF starts, it asks for these in the background (`src/lib/backend-timeouts.ts`), trying again every 2s for
about half a minute while the backend starts, and then waits 5s longer than each, so the backend's own error, which
says what timed out, arrives first. The longest matching prefix wins, and its query is left out (`timeoutFor` in
`src/lib/timeouts.ts`).

If the backend never answers, such as an older backend without the route, the BFF logs a warning and keeps its own
hand-written table in `src/lib/timeouts.ts`, the waits it used before. The BFF reads the times once: after changing
them, restart the BFF (in `pnpm dev`, saving a BFF file restarts it).

> **Frontend analogy:** like a client reading feature flags from the server at boot instead of hard-coding them, with
> the bundled defaults kept for when the request fails.

## Adding a slow endpoint

Give the handler its own `…Timeout` constant as usual. When the work can take more than 30s, add one line for its
path prefix to `relayTimeouts`; the BFF needs no change. The fallback table in the BFF only matters for an older
backend, so a new path doesn't need to go there.
