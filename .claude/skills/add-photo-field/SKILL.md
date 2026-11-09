---
name: add-photo-field
description: Use when adding a field to the photo JSON file, so its default, backfill, tests, pipeline reading and portfolio type all change together.
---

# Add a photo field

A photo is one JSON file, `photos/<PHOTONAME>.json`, combined by Commit into `ALLPHOTOS.json`
(`docs/data-model.md`). Decide first which kind of field it is:

- **A field every photo has.** It goes in `newPhotoJSON`, so new photos get its default and Update Data →
  Missing fields adds it to older files (`docs/update-data.md`, "Missing fields"). Most fields are this kind.
- **A field only some photos have.** It's left out of the defaults and read by its key, like `perceptualHash`
  and `colors` (tagged `omitempty` in `photoJSON`) or `undecided` and `spotlightZoneFocus`, which the pipeline
  reads with string constants (`UNDECIDED` in `apps/client-pipeline/src/lib/undecided.ts`,
  `SPOTLIGHT_ZONE_FOCUS` in `apps/client-pipeline/src/lib/spotlight-focus-edits.ts`). Skip steps 1 and 2 for these.

## 1. Default, in the backend

- Add the field to `photoJSON` in `apps/be-pipeline/internal/github/publish.go`, in the position it should have
  in the file, with a doc comment saying what it is and when it's nil.
- Give it its default in `newPhotoJSON` in the same file: `[]string{}` for a list, `map[string]string{}` for a
  map, nothing for a pointer (nil becomes `null`). Missing fields reads this function, so the field backfills
  with no other change. A field that isn't a default (like `id` and `addedDate`, which come from the file's
  history) needs its own step in `backfill.go`.

## 2. Tests and sample data

- Add the key to `oldPhotoGaps` in `apps/be-pipeline/internal/github/backfill_fields_test.go`, on its own line
  where it falls in the file; `TestBackfill` counts the gaps from it.
- Add the key with its default to `apps/be-pipeline/internal/github/testdata/backfill/filled.json`, in the same
  position.
- Add it to the expected new file in `TestPublishKeepsThePhotoUntilCommit` in `publish_test.go`.
- Run `cd apps/be-pipeline && go test ./internal/github/`.

## 3. Reading and writing it in the pipeline

- Type the field in `apps/client-pipeline/src/api/photos.ts` where the pipeline reads photo data, and edit it
  where the page that owns it saves: the Photo page's parts are in
  `apps/client-pipeline/src/components/edit-in-flight/` (`photo-json.ts` builds the JSON that `Update` saves),
  Site Spotlight's in `src/lib/spotlight-focus-edits.ts`. Put new UI in a new component file.
- A field the pipeline reads but the portfolio shouldn't see is stripped at build time like `notes`
  (`apps/portfolio/private-notes.ts`, `docs/photo-notes.md`).

## 4. The portfolio

- Add it to `PhotoData` in `apps/portfolio/src/lib/photos.ts` as optional (`field?: T | null`) with a comment
  that older entries don't have it, and to `Photo` as the views need it; `fromPhotoData` in the same file fills
  it in. Every view reads `Photo` (`routes/grid.tsx`, `timeline.tsx`, `map.tsx`, `color.tsx`, …), and the
  pipeline's Gallery reads photos through `photosFromData` too.
- `scripts/fixtures/shared.mjs` builds its photos from the committed `apps/portfolio/src/data`, so it keeps
  up on its own; only a fixture written by hand there needs the field.

## 5. Docs

- Describe the field in `docs/data-model.md` (in the section for its area, such as "Places, spotlights and
  posts") and in the doc of the feature that writes it, `docs/<feature>.md`.
- Run `pnpm check` and `pnpm build`, then see the `finish-feature-pr` skill.
