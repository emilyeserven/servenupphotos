# CLAUDE.md

A photography portfolio (`apps/portfolio`, static, GitHub Pages) and the local "pipeline" tool that feeds it photo
data: `apps/client-pipeline` (React UI) → `apps/bff-pipeline` (Fastify) → `apps/be-pipeline` (Go). The pipeline
reads photos, uploads them to Cloudflare R2, and keeps one JSON file per photo as a change waiting for Commit
(`docs/pending-changes.md`). The pipeline's **Commit** button is its only write of photo data to GitHub: one commit to
an **Add photo data** pull request with every waiting file and `ALLPHOTOS.json` rebuilt from them, which the portfolio reads.

The README covers setup and commands. Each feature's behavior is in `docs/<feature>.md` (listed in the README under
**Features**). Read the doc for the feature you're changing instead of the whole README.

## Map

| Where                                              | What                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/be-pipeline/internal/httpapi`                | HTTP handlers. Each area's routes are listed in its `routes_<area>.go` (`router.go` calls them). Each handler is a factory that takes its dependencies (`store`, `gh`, storage funcs) so tests can pass fakes                                                                                                                                                                                                                              |
| `apps/be-pipeline/internal/github`                 | Everything that reads or commits to GitHub. Saves go to the stage (`stage.go`); reads see the `workspace` (GraphQL `state` read once per run and `snapshot`s, kept in `localcopy.go`, with the stage over it); only `CommitCombined` writes                                                                                                                                                                                                |
| `apps/be-pipeline/internal/storage`                | R2: upload, list, find, delete, regenerate versions                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/be-pipeline/internal/versions`               | Resized WEBP versions and the Square Thumbnail                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/be-pipeline/internal/exif`, `colors`         | EXIF reading and sanitizing (`exif.SanitizeFields`), color analysis                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/be-pipeline/internal/github/publish.go`      | `newPhotoJSON`: the fields of a photo JSON file and their defaults. Adding a field here also backfills it through Update Data → Missing fields; list it in `backfill_fields_test.go` and `testdata/backfill/filled.json`                                                                                                                                                                                                                   |
| `apps/bff-pipeline/src/routes/relay.ts`            | One catch-all relay of `/api/*` to the Go backend, so new endpoints need nothing in the BFF. Each path's wait comes from the backend's `GET /timeouts` (`docs/bff-timeouts.md`)                                                                                                                                                                                                                                                            |
| `apps/client-pipeline/src/routes`                  | TanStack Router file routes. `routeTree.gen.ts` is generated by the router plugin whenever Vite runs (`dev`, `build`, `pnpm shot`); never edit it by hand                                                                                                                                                                                                                                                                                  |
| `apps/client-pipeline/src/api/<area>.ts`           | Types for each endpoint plus `queryOptions` / `mutationOptions`; every request goes through `api/request.ts` (`requestJson`, `post`, `put`, `del`, `postForm`, `requestBlob`); JSON goes through `post`, `put` or `del`, and the `servenup/json-request` lint rule (`scripts/lint/servenup-plugin.mjs`) fails a `content-type` header written anywhere else. A mutation that saves changes waiting for Commit sets `meta: { saves: true }` |
| `apps/client-pipeline/src/stores/combined-data.ts` | Zustand store for `ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`, shared by every page (see `docs/combined-data-store.md`)                                                                                                                                                                                                                                                                                                             |
| `apps/client-pipeline/src/components`              | Page parts. `app-sidebar.tsx` has the nav; `page.tsx` is the page shell; `components/ui` is shadcn/ui (generated, don't edit)                                                                                                                                                                                                                                                                                                              |
| `apps/portfolio/src/lib/photos.ts`                 | Turns the photo JSON into the portfolio's `Photo` type; every view (`routes/grid.tsx`, `timeline.tsx`, `map.tsx`, `color.tsx`, …) reads it                                                                                                                                                                                                                                                                                                 |
| `@portfolio/*` imports                             | The portfolio's Grid filters, which the pipeline's Gallery imports too (`docs/gallery.md`). Files reached from them import with `@portfolio/`, not `@/`                                                                                                                                                                                                                                                                                    |
| `apps/portfolio/map-preview`                       | Build step that writes the map's place pages (`/maps/<kind>/<place>/`) and draws their link preview images when `MAP_PREVIEWS=1` (`docs/map-link-previews.md`). `pnpm --filter @servenup/portfolio test`                                                                                                                                                                                                                                   |
| `apps/portfolio/src/data`                          | Committed photo, album and tag JSON (`docs/data-model.md`). `.ignore` keeps it out of repo-wide searches; name the folder to search it. `ALLPHOTOS.local.json` is git-ignored and made by `pnpm photos:local`                                                                                                                                                                                                                              |
| `scripts/`                                         | `combine-photo-data.mjs` (`pnpm photos:local`), `screenshot.mjs` (`pnpm shot`)                                                                                                                                                                                                                                                                                                                                                             |

### Adding a pipeline endpoint

A new endpoint usually touches, in order:

1. `be-pipeline/internal/github` or `storage`: the logic, with a `_test.go` next to it using the package's fakes
   (`newFakeGitHub`, `newMainRepo` in `github`; `fakeBucket` in `storage`).
2. `be-pipeline/internal/httpapi/<area>.go`: the handler, and one line in that area's `routes_<area>.go`. The path
   follows the route shape rules in the `add-pipeline-endpoint` skill: the method says what happens (`DELETE`, never
   `POST …/delete`), segments are lowercase and hyphenated, and an Update Data change is `POST /data/<change>` with
   optional `…/pick` and `…/preview` steps next to it.
3. `client-pipeline/src/api/<area>.ts`: the response type and the query or mutation.
4. `scripts/fixtures/<area>.mjs` (the area of the `routes_<area>.go` that registers the route): a sample answer, so `pnpm shot` can show the page. `pnpm check:fixtures`
   (part of `pnpm check`) fails when a route has none, or breaks a route shape rule (`scripts/route-shapes.mjs`).

The BFF relays every path on its own. Only when the backend gives the work more than 30s, add its path prefix to
`relayTimeouts` in `be-pipeline/internal/httpapi/timeouts.go`; the BFF reads it at start-up (`docs/bff-timeouts.md`).

## Checks

Everything here is fast; run the narrowest check while working and `pnpm check` before pushing.

```sh
pnpm check                         # oxlint, oxfmt --check, typecheck, fallow, check:fixtures, check:docs (~6s); `pnpm fmt` fixes formatting
pnpm check:fixtures                # every backend route has a fixture in scripts/fixtures/ and follows the route shape rules
pnpm build                         # all three TS apps (~5s); CI runs it too
pnpm test                          # node --test: the portfolio's map-preview and both apps' src/lib (~2s); CI runs it too
cd apps/be-pipeline && go test ./internal/github/   # one package; `./...` takes ~8s
cd apps/be-pipeline && golangci-lint run
```

`fallow` fails on dead code (unused exports, files and dependencies, duplicate exports), on any function over its
health thresholds (cyclomatic 20, cognitive 15, CRAP 30, 60 lines; the "refactoring targets" it prints are advice only),
and on any duplicate code block not in the committed baseline `fallow-baseline/dupes.json`. The five clone groups there
today pass; a new one fails `pnpm check` (and CI, which runs the same script). Split or share the code instead of
adding to the baseline. Only when a PR deliberately accepts a duplicate, run `pnpm check:fallow-baseline` and commit
the changed file.

**Tests:** `pnpm test` runs `node --test` on `*.test.ts` files: the portfolio's `map-preview/` and each app's
`src/lib/` (next to the module they test), with no test framework. `scripts/test-aliases-register.mjs` lets Node
resolve `@/` and `@portfolio/` imports, load the data JSON and stub Vite's `import.meta.glob`; a module that imports
React components (`.tsx`) can't be tested this way. Tests assert behavior with small hand-built objects.

## Conventions

- **Comments:** every exported function, type and field gets a doc comment in plain sentences saying what it is or
  does, in the user's words ("the photo data pull request", "Square Thumbnail"). Match the surrounding density.
- **Keep files small.** `in-flight.tsx`, `instagram-calendar.tsx`, `organize-page.tsx` and `group-detail.tsx` are
  already near 600 to 700 lines. The Gallery's and the photo editor's parts live in `components/gallery/` and
  `components/edit-in-flight/`. Put new UI in a new component file and import it, rather than
  growing them.
- **Display options:** every portfolio view's display options use `ViewOptionsButton`
  (`components/view-options-button.tsx`): a **Display Options** button (eye and words; the Map alone is eye only) whose
  flyout puts `choices` (`OptionChoices`, sliders) in the left column and `checks` (checkboxes in titled `OptionGroup`s)
  in the right, stacking on a phone (a flyout with only checkboxes leaves `choices` out). Next to search and **Show filters**, it goes at the right end of that row with
  `align="end"`.
- **Entry editors:** a page that edits one JSON file per entry (camera overrides, custom lenses, metadata groups, …)
  ends its editor with `EntryEditorButtons` (`components/entry-buttons.tsx`), passing the save and remove
  `mutationOptions`, `next`, `saved` and a `whyNot` function, rather than its own Save and Remove buttons. An Update
  Data card's preview uses `ScanPreviewBody` and `SaveButton` from `components/update-data-shared.tsx`.
- **Filter pickers:** build on `SectionPicker` and follow [Picker conventions](docs/portfolio-filters.md#picker-conventions):
  extra info behind `InfoButton` in the `aside` panel on the right, Group by and Sort as small menus left of the (i),
  grouping off by default, and no icons in choice lists.
- **Trip line styles:** every map or sketch of trip lines takes its color, width and dashes from `tripLineStyle` in
  `@portfolio/lib/map-theme` (MapLibre paint via `tripLinePaint`, SVG via `tripLineStroke`), never its own numbers
  ([Line styles](docs/trip-lines.md#line-styles)).
- **Errors:** show every failure with `ErrorNote` (`components/error-note.tsx`): pass it the `Error` (or a sentence
  written for the page) and it shows the message in red with `role="alert"`, plus GitHub's answer when a GitHub call
  failed. `QueryResult`, `SaveNote` and `SaveState` already use it. Don't write `text-destructive` or `{x.error.message}`
  into JSX; the `servenup/error-note` lint rule (`scripts/lint/servenup-plugin.mjs`) flags both. Red that isn't an error
  (an icon, a removed count) takes an `oxlint-disable-next-line servenup/error-note` comment saying why.
- **Saved and asking first:** after a save, say it waits for Commit, never that it's on GitHub or in the pull request:
  `SaveState` ("Saving…", "Saved for Commit") on a page that saves as you type, and `SavedInApp` (or a sentence ending
  in `WaitingForCommit`, `components/waiting-for-commit.tsx`) after a button save. Ask before losing or replacing work
  with `await askFirst({ question, note, action })` (`stores/confirm.ts`), or `ConfirmDeleteCard` for a delete that
  runs inside its dialog; never `window.confirm`, `alert` or `prompt` (oxlint `no-alert`). See
  [What a page says after a save](docs/pending-changes.md#what-a-page-says-after-a-save).
- **Empty states:** a list, grid or panel with nothing in it shows `EmptyNote`
  (`apps/portfolio/src/components/empty-note.tsx`, imported as `@portfolio/components/empty-note` in both apps), never
  a hand-styled `<p>`. It has one look (muted, small); its `className` is for spacing only. Say what's missing in a full
  sentence ("No albums yet.", not "None yet."), then what to do next when there is something to do. A photo list that
  filters or search leave empty says `NO_PHOTOS_MATCH` ("No photos match these filters."). The `servenup/empty-note`
  lint rule flags a muted `<p>` that starts "No", "None" or "Nothing".
- **Small value and date helpers:** both apps share `apps/portfolio/src/lib/values.ts` (`isObject`, `textOf` for
  trimmed text or "", `stringOf` for text as written or "", `clamp`) and `apps/portfolio/src/lib/dates.ts`
  (`isoDate`, `parseIsoDate`, `shortDate` "Nov 3, 2026", `weekdayDate` "Tue, Nov 3, 2026", `dateTimeText` for a
  moment such as an upload time). Import them (`@portfolio/lib/…` from the pipeline) instead of writing a local copy,
  and add a new date look to `dates.ts` rather than building an `Intl.DateTimeFormat` or a `date-fns` `format` in a
  component.
- **Frontend stack:** React 19, TanStack Router, TanStack Query, TanStack Form, Zustand, Tailwind 4, shadcn/ui. No
  Next.js or other full-stack frameworks. Shared versions are in the `catalog:` of `pnpm-workspace.yaml`.
- **Go:** stdlib `net/http`, errors as `writeError(w, status, message)` with messages a user can read; GitHub errors
  the user should see come back as `*github.PublishError`. A handler that reads or changes photo data on GitHub is
  `withGitHub` (or `withGitHubBody`, which decodes the body first) in `httpapi/respond.go`, which reads the settings,
  opens the timeout context and answers with `writeResult`. One that needs other settings, such as R2's, is
  `withSettings(store.R2, timeout, …)` and usually answers with `writeR2Result`; one with a JSON body wraps it in
  `withBody`. Request bodies are read only in `respond.go` (golangci-lint's `forbidigo` refuses `json.NewDecoder`
  elsewhere in `httpapi`), with unknown fields refused. Every message a user reads is a sentence with a capital and a
  full stop that says what to do next where there is something to do ("Couldn't save the tags.", "Pick the images to
  delete first."); `messages_test.go` checks the ones passed to these helpers. A name in the URL path that doesn't
  exist is a 404, a bad value in the body or query a 400.
- **Docs:** a change in behavior updates its `docs/<feature>.md`. A new feature gets a new `docs/` file and one line
  in the README's **Features** list (`pnpm check` fails on a doc missing from it or a link to a missing doc). Only touch the README itself for setup, commands or deployment. Docs explain
  backend ideas with a short "> **Frontend analogy:**" note, since the owner is a frontend engineer.
- **Section titles:** a pipeline heading over a section of a page, card or panel is `SectionTitle`
  (`components/section-title.tsx`), not a hand-styled `h2`/`h3`. `size="sm"` (the default) is a part of a card or
  panel, `size="lg"` a section of a page or drawer; `as="h2"` sets the level without changing the look.
- **Naming:**
  - **color, not colour.** `colour` is only the trip line and transit line field copied from OpenStreetMap's
    `colour` tag (in the committed trip line files) and the code that carries it. Every other field, prop and
    variable, new ones included, says `color`.
  - **Storage keys** are kebab-case with the app's prefix: `pipeline-…` in the pipeline, `servenup-…` in the
    portfolio. A new stored value uses `storedValue` (`@portfolio/lib/stored-value`). Renaming a key calls
    `moveStoredKey(old, new)` beside it so the browser keeps what it saved.
  - **Go file names** are the feature squashed into one word (`tripstories.go`, `placeareas.go`, `albumsuggest.go`),
    with an underscore only before a part of that feature (`triplines_route.go`, `bulktags_answer.go`,
    `routes_<area>.go`). Tests add `_test`.
- **Pull requests:** title is one sentence describing the change as the user sees it, such as "Show photo counts on
  the portfolio map". Squash-merged.

## Screenshots

Use `pnpm shot` instead of starting the backend or writing mocks:

```sh
pnpm shot pipeline /gallery --out <dir>            # desktop, light
pnpm shot portfolio /grid --mobile --out <dir>     # 390 × 844
pnpm shot pipeline /in-flight --script steps.mjs   # export default async ({ page, shot }) => { …; await shot("name") }
pnpm shot pipeline /albums --fixtures mine.mjs     # export default (fixtures) => ({ ...fixtures, "GET /api/organize": … })
```

It answers the pipeline's `/api` from `scripts/screenshot-fixtures.mjs`, which merges `scripts/fixtures/<area>.mjs` (built from the committed portfolio data plus
one open pull request), draws placeholders for R2 photos and a plain map background, and warns about any `/api`
request without a fixture. Add a fixture there for new endpoints.

Take as few as show the change: one desktop screenshot, plus mobile only when the layout changes and dark only when
colors change. One screenshot per state the user asked about, not per step.

## Sandbox notes

- `.claude/hooks/session-start.sh` runs when a cloud session starts: `pnpm install`, exiftool, and a warm Go build
  cache. Add a step there when a new tool is needed in every session.
- R2 (`cdn.servenupphotos.net`), GitHub's API and map tiles usually can't be reached; `pnpm shot` covers for them.
- Chromium for `pnpm shot` is already in `PLAYWRIGHT_BROWSERS_PATH`; `screenshot.mjs` falls back to its `chromium` link when the revision playwright-core wants is missing.
