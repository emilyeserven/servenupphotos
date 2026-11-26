---
name: add-photo-book-setting
description: Use when adding a setting or field to a photo book (the PhotoBook file), such as an Info tab option or something saved on a page, so the backend check, client type, logic, UI and doc change together.
---

# Add a photo book setting

A photo book is one file, `photobooks/<id>.json`, saved as a change waiting for Commit on every edit (`docs/photo-book/the-file.md`). A new setting touches these files in this order; "Let a photo book's captions leave a prefix off chosen lenses' names" (#774) is a complete example to copy.

## 1. Backend check

- Add the field to `PhotoBook` (or `PhotoBookPage`) in `apps/be-pipeline/internal/github/photobooks.go`, tagged `omitempty`, with a doc comment saying what it is and where it's set.
- Put its check in a new `photobooks_<topic>.go` as `valid<Topic>(…) (T, *PublishError)`, with limits as constants and messages a user can read, and call it from `validPhotoBook`. An unknown field is refused on save, so skipping this step makes every save fail.
- Test it in `photobooks_<topic>_test.go` and run `cd apps/be-pipeline && go test ./internal/github/ -run PhotoBook`.

## 2. Client type and logic

- Add the optional field to `PhotoBook` (or `BookPage`) in `apps/client-pipeline/src/lib/photo-book.ts`, with a doc comment, absent meaning the old behavior so older files still read.
- Put what it does in a new `src/lib/photo-book-<topic>.ts` with a `photo-book-<topic>.test.ts` next to it, not in `photo-book.ts` or a component. Run `pnpm --filter @servenup/client-pipeline test`.

## 3. UI

- An Info tab setting is a new `components/photo-book/<name>-field.tsx` taking `{ book, onChange }`, added to `info-tab.tsx`; `titles-field.tsx` is the smallest example.
- A setting on a page goes through `page-actions.ts` and `page-types.ts`, with its control in `page-controls.tsx` or a new component beside it.
- A setting that changes captions goes through `useCaptionFor` in `book-captions.ts`, which `book-editor.tsx` passes the book's settings to, so every page, the PDF and the lists under the Book tab agree.
- No new endpoint is needed: the book saves with `PUT /api/photobooks/<id>`. Its fixture in `scripts/fixtures/publish.mjs` echoes the body, so only a setting the sample book should show needs it added to the fixture's data.

## 4. Doc and checks

- Describe it in the file of `docs/photo-book/` for the tab it's on, and in `docs/photo-book/the-file.md` when it's saved in the file.
- Take one screenshot with `pnpm shot pipeline /photo-books/sample-book/<tab>`, then follow the `finish-feature-pr` skill.
