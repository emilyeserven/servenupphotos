# The photo book file

Each book is one file, `photobooks/<id>.json`, and **Commit** combines them into `photobooks/PHOTOBOOKS.json`, as it does caption templates. Every change on the page is saved as a [change waiting for Commit](../pending-changes.md) (`PUT /api/photobooks/<id>`, `DELETE /api/photobooks/<id>`) under a second after the last one, so typing a caption saves once; the note beside **Photos** says **Saving…** until it has.

```json
{
  "id": "korea-2026",
  "name": "Korea 2026",
  "template": "",
  "album": "korea",
  "size": { "width": 12.5, "height": 10.625, "unit": "in" },
  "pages": [
    {
      "id": "page-1",
      "name": "Seoul opener",
      "layout": "full",
      "title": "Seoul",
      "linkNext": true,
      "tags": ["Seoul"],
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }]
    },
    { "id": "page-2", "name": "Seoul pair", "layout": "pair-left", "title": null, "slots": […] },
    { "id": "page-3", "name": "Bio", "layout": "other", "title": null, "slots": [] },
    { "id": "page-5", "name": "Places Index", "layout": "other", "title": "Places", "slots": [], "generated": { "kind": "places-index", "columns": 2 } },
    { "id": "page-4", "layout": "text", "title": "Getting around", "text": "## The subway\n\nNine lines…", "columns": 2, "slots": […] }
  ],
  "order": ["page-3", "page-1"],
  "hiddenLayouts": ["pair-left"]
}
```

- **`slots`** are a page's photo places, each `{ "photo", "caption" }`: the photo file's path (`""` while empty) and a caption typed over the template's, or `null`. **`hidden`**, the parts of the photo's location its caption leaves out and the lines it leaves out (`"place:<id>"`, `"placeName"`, `"city"`, `"state"`, `"country"` or `"line:<n>"`, 0 for the first line, up to 40), is left out while there are none.
- **`template`** is the caption template's ID, or `""` for the default one.
- **`album`** is the ID of the album the book's photos come from, or `""` (or missing, in a book made before) while none is picked.
- **`budget`** is the page budget from **Info**, `{ target, max }`, each a whole number of printed pages up to 500 with `target` no more than `max`; a number not set is left out, and so is a budget with neither.
- **`size`** is the page size from **Info**, `unit` one of `in`, `cm`, `mm`, `pt` or `px`; a book without one uses 12.5 × 10.625 in.
- **`layout`** is `full`, `pair-left`, `pair-right`, `verticals-left` or `verticals-right`, `text` for a text page, `other` for an other page, or the ID of one of the book's `layouts`; the backend fills or cuts `slots` to the layout's count (none for `other`, as many as were sent up to 4 for `text`).
- **`text`** is a text page's text in Markdown, trimmed, up to 5,000 characters, and **`columns`** how many columns it flows into, 2 or 3; both are left out on one without (one column) and on every other page. **`textSide`** is `left` or `right` when a text page's text goes beside its photos, left out for text above them and on every other page; any other value is refused.
- **`generated`** is set only on a generated other page: `{ kind: "places-index", names: "romanized" | "romanizedLocal" | "localRomanized" | "local" | "namedLocal", stateAbbreviations, depth: "country" | "state" | "city", order: "book", columns (2 or 3), pages (2 to 20), textSize (50 to 200, in steps of 5), fitLines, entrySizes, hidden }`, each option left out while off or at its default (names as written, every place, alphabetical, one column, one page, text size 100), and `hidden` the entries left out of the index (`"country:<name>"`, `"state:<name>"`, `"city:<name>"`, `"place:<place ID>"` or `"placeName:<text>"`, each once, up to 500). `fitLines` is true while **Shrink lines to fit** is on, and `entrySizes` maps an entry, by the same keys as `hidden`, to its line's own size in percent of the list's text size (50 to 95, in steps of 5; an entry at 100 is left out, up to 500). A page saved before `names` with `localized: true` is saved with `names: "localRomanized"` instead. An unknown kind, name style, level or order is refused, and `generated` is dropped from any page that isn't an other page.
- **`layouts`** are the book's own layouts from the **Layouts** tab, each `{ id: "custom-<n>", name, photos (1–4), arrange: "stack" | "row", shape: "landscape" | "portrait" | "square" | "ratio" | "fill", ratio: { width, height } (only with "ratio", each more than 0 and at most 100), text: "left" | "right" | "above" | "below", captions: "column" | "photo", textShare (10–60), align: "start" | "center" | "end", alignTo: "room" | "photo", title: "text" | "top" | "off", gap (0–20), margin (0–20), leftPages: "mirror" | "same" | "own", left: { the same settings but id, name, photos and leftPages } (only with "own"), standard: the ID of the standard layout it was saved as or added from (left out for none) }`, the numbers in percent of the page; left out while there are none. A layout without `leftPages` (made before) draws the same on both sides. A page whose layout isn't there is refused.
- **`noTitles`** is `true` when **Show page titles** is off on **Info**, and left out otherwise.
- **`noCaptionTitles`** is `true` when **Caption titles** is off on **Info**, so captions filled in from the template leave their title line out and draw every line alike, and left out otherwise.
- **`lensPrefixes`** are **Lens names**' prefixes, each `{ "lens": "Fujinon XF35mmF2 R WR", "prefix": "Fujinon " }`: the lens as the photo's data has it, after overrides, and what the captions leave off it, up to 100 lenses, each once; left out while there are none.
- **`cameraNames`** are **Camera names**' names, each `{ "camera": "Fujifilm X-T5", "name": "X-T5" }`: the camera as the photo's data has it, after overrides, and what the captions call it, both trimmed, up to 100 cameras, each once; one with an empty name or the camera's own is dropped, and the list is left out while there are none.
- **`cover`** is the cover from the **Cover** tab, `{ title, author, volume, spine, background, color }`: the title with a line break between its lines (up to 200 characters), the rest trimmed and each up to the entry text limit, left out while empty, and the colors as `#rrggbb`, left out for black and white. The whole `cover` is left out until the tab is changed ([The cover](cover.md#the-cover)).
- **`blurb`** is **Blurb sizes** from **Info**, `{ pageWidth, pageHeight, coverWidth, coverHeight, spine, bleed }`, in inches, each more than 0 and at most 100 (the bleed may be 0), with the spine and four bleeds narrower than the cover and two bleeds shorter; left out for a 78-page Large Landscape book's sizes ([Blurb sizes](cover.md#blurb-sizes)).
- **`hiddenLayouts`** are the IDs of the built-in layouts hidden on **Layouts**, left out when none is.
- **`name`** is the page's name, left out until it has one.
- **`alternates`** is the page's alternates group, such as `alt-1`, shared by a spread's pages, and **`hidden`** is `true` on one that lost to the one picked; the backend keeps `hidden` only on an alternate. Both are left out when not set.
- **`tags`** are the page's tags from **Photo Pages**, trimmed, each once, at most 20; left out when it has none.
- **`linkNext`** is `true` on a photo page linked with the photo page after it into a spread, in the order of `pages`.
- **`pages`** is every page made for the book, and **`order`** the IDs of the pages and spreads in the book, in its order, a spread listed by its first page. A book made before `order` has none, and then every page is in it, in their order; adding a page writes it. A spread's second page listed too (as **Import Book** writes every page) counts as the spread.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes to a page (`placePhoto`, `setLayout`, `renamePage`, …), `src/lib/photo-book-text.ts` a text page's text, columns and photo places, `src/lib/photo-book-cover.ts` the cover and Blurb's sizes, `src/lib/photo-book-generated.ts` generated pages and their options, `src/lib/photo-book-layouts.ts` the book's layouts (`addLayout`, `changeLayout`, `removeLayout`, `sideLook`, `setLeftPages`, `setHidden`), `src/lib/photo-book-standard.ts` the standard layouts (`saveAsStandard`, `addStandard`, `setHiddenEverywhere`), `src/lib/photo-book-order.ts` the changes to which pages make spreads and which are in the book (`bookUnits`, `addToBook`, `setLinkNext`, `bookViews`, …), `src/lib/photo-book-album.ts` and `components/photo-book/album-photos.ts` find the album's photos, and `apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
