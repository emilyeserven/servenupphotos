---
name: add-pipeline-endpoint
description: Use when adding or changing an /api route in the pipeline (Go backend, BFF relay, React client), to touch every layer in order and skip none.
---

# Add a pipeline endpoint

A new `/api` route touches the Go backend, the client's API module and the screenshot fixtures. The BFF relays
every `/api/*` path on its own (`apps/bff-pipeline/src/routes/relay.ts`), so it needs nothing unless the work is
slow. How saves reach GitHub is in `docs/saving-to-github.md` and `docs/pending-changes.md`.

## 1. Logic, in Go

- Put the work in `apps/be-pipeline/internal/github/<name>.go` when it reads or saves photo data (saves go to the
  stage; only `CommitCombined` writes to GitHub), or in `apps/be-pipeline/internal/storage/<name>.go` when it
  talks to R2. A method on `*Client` in `github`, a plain function in `storage`.
- Errors the user should see come back as `*github.PublishError` (`apps/be-pipeline/internal/github/publish.go`),
  with a message a user can read.
- Write `<name>_test.go` next to it with the package's fakes:
  - `github`: `newFakeGitHub(t)` in `fake_test.go` returns a `*fakeGitHub` (an in-memory repository that counts
    its calls and can `fail` one) and the `*Client` pointed at it.
  - `storage`: each test file builds an `httptest.NewServer` standing in for R2, as `fakeR2Upload` in
    `upload_test.go` and `fakeR2Regenerate` in `regenerate_test.go` do.
- Give every exported function, type and field a doc comment in the user's words.

## 2. Handler and route

- Add the handler to `apps/be-pipeline/internal/httpapi/<area>.go` as a factory that takes its dependencies
  (`store *settings.Store`, `gh *github.Client`, storage funcs) and returns an `http.HandlerFunc`, so tests can
  pass fakes. `captions.go` is a short example.
- Answer with `writeJSON(w, status, body)`; fail with `writeError(w, status, message)`, or with
  `writePublishError(w, perr)` after `errors.As(err, &perr)` for a `*github.PublishError` (all in `respond.go`).
- Add one line to that area's `routes_<area>.go`, such as
  `mux.HandleFunc("POST /data/thing", handleThing(d.store, d.gh))`; `router.go` calls every
  `register<Area>Routes`. The pattern has no `/api` prefix: the BFF strips it.
- A new area gets a `routes_<area>.go` with a `register<Area>Routes(mux *http.ServeMux, d routeDeps)` and one
  call in `routes` in `router.go`.
- Handler tests in `httpapi/<area>_test.go` build the router with `NewRouter(nil, store)` or `newRouter` and send
  `httptest` requests, as `pending_test.go` does.

## 3. Client

- In `apps/client-pipeline/src/api/<area>.ts`, add the response and body types (a doc comment on each field) and
  a `queryOptions` for a read (`requestJson<T>` from `@/api/settings`, as in `areas.ts`) or a `mutationOptions`
  for a write (`post<T>` from `@/api/data`, as in `alt-text.ts`).
- A mutation that saves a change waiting for Commit sets `meta: { saves: true }` (with `changes:` when the result
  lists the files it changed; see `scan-changes.ts`), so the pending changes refresh.

## 4. Fixture

- Add a sample answer to the returned object of `scripts/fixtures/<area>.mjs` (the `routes_<area>.go` that registers the route), keyed `"METHOD /api/path"`
  (such as `"POST /api/data/alt-text/pick"`), so `pnpm shot` can draw the page and doesn't warn.

## 5. Only if the backend gives the work more than 30s

- Add the path prefix to `TIMEOUTS` in `apps/bff-pipeline/src/lib/timeouts.ts` with a wait a little longer than
  the backend's, and a comment saying what takes the time.

## Checks

```sh
cd apps/be-pipeline && go test ./internal/github/      # or ./internal/storage/ ./internal/httpapi/
cd apps/be-pipeline && golangci-lint run
pnpm check                                             # oxlint, oxfmt --check, typecheck, fallow
```

Then update `docs/<feature>.md` and screenshot the page: see the `finish-feature-pr` skill.
