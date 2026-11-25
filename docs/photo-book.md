# Photo Book

`/photo-books`, **Photo Books** under **Publish** in the sidebar, is for roughing out a photo book before laying it out for real in the book maker's own software: which photos go on which page, in what layout, and what their captions say. The pages are drawn like the printed books (black, in Helvetica: a bold uppercase page title, each caption's first line bold and the lines under it small) in the shape the book's page size gives them, but only as a sketch, for reference while placing the photos and captions by hand. Text sizes are in `cqw`, shares of the page's width, so they scale with it.

## Books

**Photo Books** lists every book as a card, with the album its photos come from, how many pages are in the book (and how many more could be used), and how many photos are on them; each card opens the book's own page, as the Trips do. **New book** names and makes another (its ID is made from the name, as caption templates' are) and opens it. An old `/photo-book` link opens the list, or the book its `?book=<id>` names.

On a book's page, **All photo books** goes back to the list. Under it, three tabs, each a page of its own with a line under the tabs saying what it's for:

- **Info** (`/photo-books/<id>/info`): the book's name, album, caption template and page size.
- **Layouts** (`/photo-books/<id>/layouts`): trying out page layouts at the book's page size.
- **Photo Pages** (`/photo-books/<id>/pages`, where the book opens): making photo pages that could be used, and linking them into spreads.
- **Book** (`/photo-books/<id>/book`): putting the pages that will be used in order, adding other pages, and paging through the book.

## Info

**Name** renames the book, **Photos from** picks the album its photos come from, **Captions from** picks the [caption template](caption-templates.md) its captions are filled in with, and **Remove book** removes it after asking.

**Page size** takes the page's width and height in inches, centimeters, millimeters, points or pixels, starting at BookWright's large landscape page, 12.5 × 10.625 in. Only the shape is used: every page on every tab is drawn with width over height as its `aspect-ratio`, shown beside the fields as a small black page. A side that isn't a number more than 0 isn't saved.

## Layouts

The **Layouts** tab lists the built-in layouts, then **This book's layouts**, each with how many pages have it. The picked one is drawn on the right as a page in the book's shape, with the album's photos, their captions from the caption template and a title; **Other photos** tries the next few photos of the album. The page is cut off at its edge, as the printed one would be, so text that doesn't fit shows it.

Built-in layouts stay as they are. The copy button beside any layout (or **Customize** under a built-in one) makes a layout of the book's own from its settings, named after it, to change:

- **Photos:** 1 to 4.
- **Arrange the photos:** one under another, or side by side.
- **Photo size:** landscape 3:2, portrait 2:3, square, or **Fill the room**, which gives each photo all the room it has and crops it to fill.
- **Title and captions:** on the left, right, above or below the photos, **Together in one column** or **Beside each photo**, and where they sit in their room (top, middle or bottom).
- **Room for the text**, **Gap** and **Margin**: shares of the page, as sliders.

Every change shows on the preview at once and is saved as a change waiting for Commit. The book's layouts show up on **Photo Pages** after the built-in ones, in each page's layout buttons and **Add page**. A layout that holds fewer photos now takes the extra ones off its pages; **Remove layout** asks first when pages have it, and they become full pages.

> **Frontend analogy:** a built-in layout is a hand-written component; a book's layout is data fed to one generic component, like a CMS block whose props (flex direction, `flex-basis`, `gap`, padding, `aspect-ratio`) come from a JSON file. Sizes are in `cqw`, so the preview and the small pages on the other tabs look the same.

## Photo Pages

The **Photo Pages** tab holds every photo page made for the book, so other ways of laying out the same photos can be tried side by side, such as one run of pages sorted by place and another by theme. **Add page** at the end asks for the new page's layout:

- **Full page:** one photo over the page, the title above it and its caption under it.
- **Two photos on the left:** two photos down the left side, each with its caption beside it on the right, toward the gap between them (the top one low beside its photo, under the title; the bottom one at its photo's top), as the printed books have them.
- **Two photos on the right:** the same, mirrored: photos on the right, captions on the left.
- **Two portrait photos, info on the right:** one row of three columns: the two portrait photos side by side, then an info column with the title and both captions, in the photos' order.
- **Two portrait photos, info on the left:** the same, mirrored: info, photo 1, photo 2.

Each photo place keeps its shape whatever room the page gives it: 3:2 for the landscape places, 2:3 for the portrait ones, as large as fits, with the photo cropped to fill it.

> **Frontend analogy:** each place is a CSS size container (`container-type: size`) whose photo is `min(100cqw, 150cqh)` wide with `aspect-ratio: 3 / 2`, so it's as big as it can be without stretching, whichever side runs out first.

Pages have no numbers here. Above each page, its name, typed in (**Untitled page** until it has one), its layout's buttons (to switch it; a photo past the new layout's places comes off the page), the **H** button that adds or takes off a title (typed on the page itself), and the bin that removes it. Clicking a caption types over it.

### Spreads

**Link with next page**, above a page, links it with the photo page after it into a two-page spread, shown side by side across the row with **Unlink** above it; a spread's pages always follow each other, so the arrows beside it move the page or the whole spread one place earlier or later among the photo pages, to line up the two to link. A page before a spread can't link to it. **In book** marks a page or spread that's in the book. Removing one page of a spread leaves the other on its own, in the book where the spread was.

## The book

The **Book** tab has three parts, as the book makers' own software does:

- **The preview**, as large as fits, keeping the pages' shape: one page or spread at a time, with **‹** and **›** under it to page through, where it is (**Pages 3–4 of 12**) and the pages' names, and **Preview Mode**.
- **Used page spreads**, beside it (under it on a narrow screen): the pages and spreads in the book, in order, top to bottom, each a small preview with its page numbers and name. Click one to show it in the preview; drag one onto another to put it before it, or onto the box at the end; the arrows move it and **×** takes it out, leaving it among the ones that could be used. The panel's button collapses it to a thin rail.
- **All pages and spreads**, a drawer along the bottom of the window: every photo page and spread made on **Photo Pages**, then the other pages, each a small preview, dimmed and marked **In book** when it's in. Drag one into **Used page spreads**, or its **+** adds it at the end; drag one from **Used page spreads** onto the drawer to take it out. Its heading opens and closes it.

When a photo is on more than one page in the book, each of them is marked **Also on page …** on **Photo Pages**.

### Other pages

Other pages are pages without photos: one the publisher requires, a bio page, or anything else. For now each shows only its name, as a placeholder. Type a name in the drawer and **Add other page** makes one and adds it at the end of the book; each has a bin in the drawer that removes it. They're not on **Photo Pages** and are never part of a spread.

### Preview Mode

**Preview Mode** collapses the app's sidebar, **Used page spreads** and the drawer, makes the preview larger, and shows the book as it opens: two pages facing each other, a spread on its own, and a page before a spread facing nothing. **Esc** or **Leave Preview Mode** turns it off and opens the sidebar again if it was open; the arrow keys page through the book. Opening either panel leaves it too.

> **Frontend analogy:** the drawer and **Used page spreads** share one HTML5 drag type carrying the page or spread's ID, so each is both a source and a drop target, like a sortable list fed from a palette. The preview's views are derived state: the book's order grouped one way or the other, recomputed each render rather than stored.

## The photo drawer

**Photos**, on the **Photo Pages** tab, opens and closes a drawer to the right of the pages (under them on a narrow screen), like the [Instagram calendar's](publish.md#photo-drawer). It lists the photos of the book's album and the albums inside it (Smart Albums by their rules), in the album's order as the portfolio shows it, with changes waiting for Commit, and not the [Undecided](photos-in-flight.md#undecided) ones. Until an album is picked it asks for one. It has:

- a search by title or file name,
- **Filter** beside it, which opens the portfolio Grid's filters (places, album, tag, genre, camera, lens, the setting and time of day sliders, and colors, as on the [Gallery](gallery.md)) in a flyout, saying how many are set; the photos stay in the album's order, and the filters stay in the URL,
- **Show photos already in the book**, off at first, so each photo is used once.

Drag a photo onto any place on a page, or click it to fill the first empty place on any page. A photo dragged from one place to another moves there with its caption, swapping with the photo already there; one dragged from a page onto the drawer comes off that page. The × on a photo also takes it off. A photo from the drawer always goes in as a new one, so with **Show photos already in the book** on, the same photo can be put on a second page.

> **Frontend analogy:** the drawer and the pages share one HTML5 drag type that carries the photo file's path, like `dataTransfer.setData("text/uri-list", …)`; a drag from a page also carries the place it started from (`page:slot`), so each drop target knows whether it's a move or a new photo.

## Captions

Each photo's caption is filled in from its data with the book's caption template, the same templates and placeholders the Photo page's **Generate** uses for social media posts, including changes not committed yet. With no template picked, the book uses the first template for the **Photo Book** platform, or else the first one for any platform. Typing in a caption keeps what's typed instead, and **From template** under it goes back to the template's.

## The file

Each book is one file, `photobooks/<id>.json`, and **Commit** combines them into `photobooks/PHOTOBOOKS.json`, as it does caption templates. Every change on the page is saved as a [change waiting for Commit](pending-changes.md) (`PUT /api/photobooks/<id>`, `DELETE /api/photobooks/<id>`) under a second after the last one, so typing a caption saves once; the note beside **Photos** says **Saving…** until it has.

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
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }]
    },
    { "id": "page-2", "name": "Seoul pair", "layout": "pair-left", "title": null, "slots": […] },
    { "id": "page-3", "name": "Bio", "layout": "other", "title": null, "slots": [] }
  ],
  "order": ["page-3", "page-1"]
}
```

- **`template`** is the caption template's ID, or `""` for the default one.
- **`album`** is the ID of the album the book's photos come from, or `""` (or missing, in a book made before) while none is picked.
- **`size`** is the page size from **Info**, `unit` one of `in`, `cm`, `mm`, `pt` or `px`; a book without one uses 12.5 × 10.625 in.
- **`layout`** is `full`, `pair-left`, `pair-right`, `verticals-left` or `verticals-right`, `other` for an other page, or the ID of one of the book's `layouts`; the backend fills or cuts `slots` to the layout's count (none for `other`).
- **`layouts`** are the book's own layouts from the **Layouts** tab, each `{ id: "custom-<n>", name, photos (1–4), arrange: "stack" | "row", shape: "landscape" | "portrait" | "square" | "fill", text: "left" | "right" | "above" | "below", captions: "column" | "photo", textShare (10–60), align: "start" | "center" | "end", gap (0–20), margin (0–20) }`, the numbers in percent of the page; left out while there are none. A page whose layout isn't there is refused.
- **`name`** is the page's name, left out until it has one.
- **`linkNext`** is `true` on a photo page linked with the photo page after it into a spread, in the order of `pages`.
- **`pages`** is every page made for the book, and **`order`** the IDs of the pages and spreads in the book, in its order, a spread listed by its first page. A book made before `order` has none, and then every page is in it, in their order; adding a page writes it. A spread's second page listed too (as **Import Book** writes every page) counts as the spread.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes to a page (`placePhoto`, `setLayout`, `renamePage`, …), `src/lib/photo-book-layouts.ts` the book's layouts (`addLayout`, `changeLayout`, `removeLayout`), `src/lib/photo-book-order.ts` the changes to which pages make spreads and which are in the book (`bookUnits`, `addToBook`, `setLinkNext`, `bookViews`, …), `src/lib/photo-book-album.ts` and `components/photo-book/album-photos.ts` find the album's photos, and `apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
