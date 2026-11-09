---
name: finish-feature-pr
description: Use before opening or updating a pull request, to run every check, update the feature's doc, take the screenshots and write the title.
---

# Finish a feature pull request

Run through this before `gh pr create` or pushing more commits to an open pull request.

## 1. Checks

```sh
pnpm check                                   # oxlint, oxfmt --check, typecheck, fallow (~6s)
pnpm build                                   # all three TS apps (~5s); CI runs it too
cd apps/be-pipeline && go test ./...         # when Go changed (~8s)
cd apps/be-pipeline && golangci-lint run     # when Go changed
pnpm --filter @servenup/portfolio test       # when apps/portfolio/map-preview changed
```

- `pnpm fmt` fixes formatting. `fallow` fails on dead exports, duplicated code and functions with cyclomatic
  complexity over 4 (every `?:`, `??`, `?.`, `&&` and `||` counts): split the function, don't add an ignore.
- Never edit `apps/client-pipeline/src/routeTree.gen.ts` or `components/ui` by hand; Vite regenerates the first.

## 2. Conventions

- Every exported function, type and field has a doc comment in plain sentences saying what it is or does, in
  the user's words ("the photo data pull request", "Square Thumbnail"), at the density of the file around it.
- Go errors are `writeError(w, status, message)` with a message a user can read; GitHub errors the user should
  see are `*github.PublishError`.
- New UI went into a new component file rather than growing `in-flight.tsx`, `instagram-calendar.tsx`,
  `organize-page.tsx` or `group-detail.tsx`.
- A pipeline mutation that saves a change waiting for Commit has `meta: { saves: true }`; a new `/api` route has
  a fixture in `scripts/fixtures/<area>.mjs`.

## 3. Docs

- A change in behavior updates its `docs/<feature>.md` (the README's **Features** list names each one).
- A new feature gets a new `docs/<feature>.md` and one line in the README's **Features** list, in the same form
  as its neighbors: link, the route in parentheses, one sentence. Backend ideas get a short
  "> **Frontend analogy:**" note.
- Touch the README itself only for setup, commands or deployment.

## 4. Screenshots

Use `pnpm shot`, not a running backend or mocks; it answers `/api` from `scripts/screenshot-fixtures.mjs`:

```sh
pnpm shot pipeline /gallery --out <dir>            # desktop, light
pnpm shot portfolio /grid --mobile --out <dir>     # 390 × 844
pnpm shot pipeline /in-flight --script steps.mjs   # export default async ({ page, shot }) => { …; await shot("name") }
pnpm shot pipeline /albums --fixtures mine.mjs     # export default (fixtures) => ({ ...fixtures, "GET /api/organize": … })
```

- Take as few as show the change: one desktop screenshot, one per state the user asked about (not per step).
- Mobile only when the layout changes; dark only when colors change.
- Add a fixture for any `/api` request `pnpm shot` warns has none.

## 5. The pull request

- Title: one sentence describing the change as the user sees it, such as "Show photo counts on the portfolio
  map". Pull requests are squash-merged, so the title becomes the commit on `main`.
- Body: what changed and why, the screenshots, and what was checked, ending with the attribution lines the
  session gave you, when it gave any.
- Only the pipeline's Commit writes photo data to GitHub: a pull request from here never adds to the
  **Add photo data** pull request or changes `apps/portfolio/src/data`.
