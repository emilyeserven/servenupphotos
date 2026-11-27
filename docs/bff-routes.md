# Routes the BFF answers

A few `/api` routes are answered by the BFF (`apps/bff-pipeline/src/routes`) itself instead of being relayed to the Go backend, so their code is TypeScript that fallow, oxlint and `node --test` check like the rest of the frontend.

## Which routes

- `GET /api/areas?q=`: the area search on OpenStreetMap, by name or Wikidata ID ([areas](trip-lines/areas.md)). `routes/areas.ts`, with the logic in `lib/areas.ts` (reading the answers), `lib/area-finder.ts` (asking Nominatim and Wikidata, one request a second), `lib/area-search.ts` (the answer and its errors), `lib/gate.ts` and `lib/memo.ts`.
- `GET /api/basemap`: the CARTO key for basemap tiles ([the Trip Lines page](trip-lines/the-page.md)). `routes/basemap.ts`.

Everything else goes to Go through the catch-all relay (`routes/relay.ts`). A route belongs here only when it needs none of the Go backend's state: no reads or saves through the GitHub layer (the stage of changes waiting for Commit and the copy of the repository), no R2, no settings and no image work. Those stay in Go, since splitting that state across two processes would leave two copies of it. `GET /api/hello` stays in Go too, as the Status page uses it to check that Go answers through the BFF.

> **Frontend analogy:** the GitHub layer is like one Zustand store holding unsaved edits. Routes that read or change it must live where the store lives; a route that only calls a public API, like the area search, is like a component that fetches on its own and can live anywhere.

## How it sits beside the relay

`src/index.ts` registers these route plugins before the relay. Fastify picks a route with a fixed path, such as `/areas`, over the relay's `/*` whatever the order, so the client calls the same `/api/...` paths as before and nothing changes for it, for docker-compose or for the deploy. The relay's timeouts ([how long the BFF waits](bff-timeouts.md)) don't apply here: each route keeps its own, such as the area search's 28 seconds.

The environment variables these routes read (`CARTO_KEY`, `NOMINATIM_URL`, `WIKIDATA_URL`) are passed to the BFF in both docker-compose files from the repo's `.env`, and read in `src/env.ts`.

## Adding one

Put the route in its own file in `src/routes` and register it in `src/index.ts` before the relay, with its logic in `src/lib` beside a `*.test.ts` (run with `pnpm --filter @servenup/bff-pipeline test`, which uses tsx so the `.js` imports resolve). Answer errors as `{ "message": "…" }` with the same status codes the Go backend uses. `pnpm check fixtures` reads the BFF's `app.get(...)` lines as well as Go's routes, so the route still needs a screenshot fixture in `scripts/fixtures/`.
