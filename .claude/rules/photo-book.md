---
paths:
  - "apps/client-pipeline/src/components/photo-book/**"
  - "apps/client-pipeline/src/components/caption-templates/**"
  - "apps/client-pipeline/src/lib/photo-book*"
  - "apps/client-pipeline/src/lib/caption*"
  - "apps/be-pipeline/internal/github/photobooks*"
  - "apps/be-pipeline/internal/github/captions*"
  - "apps/be-pipeline/internal/bookpdf/**"
  - "docs/photo-book/**"
  - "docs/caption-templates.md"
---

# Photo books and caption templates

Where the Photo Book page's code lives, so a change starts in the right file. The behavior is in [`docs/photo-book.md`](../../docs/photo-book.md) (one file per tab in `docs/photo-book/`) and [`docs/caption-templates.md`](../../docs/caption-templates.md). A new book setting follows the `add-photo-book-setting` skill.

- `lib/photo-book.ts`: the `PhotoBook` type and its pages, places and layouts; about 70 files import it, so add a field's type here and its logic in a new `lib/photo-book-<topic>.ts` with a test next to it, as `photo-book-lenses.ts` and `photo-book-hidden.ts` are
- `lib/photo-book-order.ts`: units (a page, or two pages linked into a spread), book order and alternates; `photo-book-layouts.ts` the layouts made on the Layouts tab; `photo-book-budget.ts`, `photo-book-dpi.ts`, `photo-book-pdf.ts` and `photo-book-text.ts` their one topic each
- `lib/caption-template.ts`: fills a caption template from a photo's data; `caption-place-form.ts` the place name builder, `caption-styles.ts` `<small>`, `<i>` and `<gap />`, `caption-overflow.ts` whether a caption fits its room
- `components/photo-book/book-editor.tsx`: the five tabs and the `PageLook` every page is drawn with; `use-photo-book.ts` holds the book being edited and saves each change as a change waiting for Commit
- One component per tab: `info-tab.tsx` (each setting is its own `*-field.tsx`), `layouts-tab.tsx`, `pages-tab.tsx` (Photo Pages), `book-tab.tsx` (the preview, the units drawer and the lists under it), `list-tab.tsx`
- A page: `book-page.tsx` draws the printed page, `page-body.tsx` lays out its places, `page-slot.tsx` one photo's place, `slot-caption.tsx` its caption, `text-body.tsx` and `custom-body.tsx` text pages and layouts made on the Layouts tab, `generated-body.tsx` generated pages such as the Places Index (`lib/photo-book-generated.ts`, `lib/photo-book-places-index.ts`), `page-controls.tsx` the controls above it, and `page-actions.ts` with `page-types.ts` what a page can change in its book
- `book-captions.ts`: the caption template a book uses and `useCaptionFor`, which every caption is filled in through
- Backend: `internal/github/photobooks.go` has the `PhotoBook` file type and `validPhotoBook`, which checks every field on save; each newer field's checks are in `photobooks_<topic>.go` with a test. `captions.go` is the caption template file, `internal/bookpdf` and `httpapi/bookpdf.go` make **Save as PDF** with a headless Chrome, and `httpapi/spreadimage.go` with `components/photo-book/book-spread-image.tsx` **Save as image** of one spread, and `book-spread-images.tsx` **Save all as images**
- Screenshots: `pnpm shot pipeline /photo-books/sample-book/pages` draws the sample book from `scripts/fixtures/publish.mjs` and the committed `photobooks/` data
