# Photo Book

`/photo-books`, **Photo Books** under **Publish** in the sidebar, is for roughing out a photo book before laying it out for real in the book maker's own software: which photos go on which page, in what layout, and what their captions say. The pages are drawn like the printed books (BookWright's large landscape page, 900 × 765, black, in Helvetica: a bold uppercase page title, each caption's first line bold and the lines under it small) but only as a sketch, for reference while placing the photos and captions by hand. Text sizes are in `cqw`, shares of the page's width, so they scale with it.

## Books

**Photo Books** lists every book as a card, with the album its photos come from, how many pages are in the book (and how many more could be used), and how many photos are on them; each card opens the book's own page, as the Trips do. **New book** names and makes another (its ID is made from the name, as caption templates' are) and opens it. An old `/photo-book` link opens the list, or the book its `?book=<id>` names.

On a book's page, **All photo books** goes back to the list, **Name** renames the book, **Photos from** picks the album its photos come from, **Captions from** picks the [caption template](caption-templates.md) its captions are filled in with, and **Remove book** removes it after asking. Under them, two tabs, each a page of its own:

- **Pages** (`/photo-books/<id>/pages`, where the book opens): making pages that could be used.
- **Book** (`/photo-books/<id>/book`): putting the pages that will be used in order.

## Pages

The **Pages** tab holds every page made for the book, newest last, so other ways of laying out the same photos can be tried side by side, such as one run of pages sorted by place and another by theme. **Add page** at the end asks for the new page's layout:

- **Full page:** one photo over the page, the title above it and its caption under it.
- **Two photos on the left:** two photos down the left side, each with its caption beside it on the right, toward the gap between them (the top one low beside its photo, under the title; the bottom one at its photo's top), as the printed books have them.
- **Two photos on the right:** the same, mirrored: photos on the right, captions on the left.
- **Two portrait photos, info on the right:** one row of three columns: the two portrait photos side by side, then an info column with the title and both captions, in the photos' order.
- **Two portrait photos, info on the left:** the same, mirrored: info, photo 1, photo 2.

Each photo place keeps its shape whatever room the page gives it: 3:2 for the landscape places, 2:3 for the portrait ones, as large as fits, with the photo cropped to fill it.

> **Frontend analogy:** each place is a CSS size container (`container-type: size`) whose photo is `min(100cqw, 150cqh)` wide with `aspect-ratio: 3 / 2`, so it's as big as it can be without stretching, whichever side runs out first.

Pages are shown one to a row, or two on a very wide screen. Above each page, its number in the book or **Not in the book**, its layout's buttons (to switch it; a photo past the new layout's places comes off the page), the **H** button that adds or takes off a title (typed on the page itself), **Add to book** (which adds it at the end of the book) or **Take out**, and the bin that removes it. A new page isn't in the book until it's added. Clicking a caption types over it.

## The book

The **Book** tab shows the pages in the book, numbered in its order, two to a row like spreads, each with arrows that move it earlier or later and **Take out**, which leaves it among the pages that could be used. Under them, **Pages not in the book** lists the rest, each with **Add to book**. When a photo is on more than one page in the book, each of them is marked **Also on page …**.

## The photo drawer

**Photos**, on the **Pages** tab, opens and closes a drawer to the right of the pages (under them on a narrow screen), like the [Instagram calendar's](publish.md#photo-drawer). It lists the photos of the book's album and the albums inside it (Smart Albums by their rules), in the album's order as the portfolio shows it, with changes waiting for Commit, and not the [Undecided](photos-in-flight.md#undecided) ones. Until an album is picked it asks for one. It has:

- a search by title or file name,
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
  "pages": [
    {
      "id": "page-1",
      "layout": "full",
      "title": "Seoul",
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }]
    }
  ],
  "order": ["page-1"]
}
```

- **`template`** is the caption template's ID, or `""` for the default one.
- **`album`** is the ID of the album the book's photos come from, or `""` (or missing, in a book made before) while none is picked.
- **`layout`** is `full`, `pair-left`, `pair-right`, `verticals-left` or `verticals-right`; the backend fills or cuts `slots` to the layout's 1 or 2.
- **`pages`** is every page made on the **Pages** tab, and **`order`** the IDs of the ones in the book, in its order. A book made before `order` has none, and then every page is in it, in their order; adding a page writes it.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes (`placePhoto`, `setLayout`, `addToBook`, `moveInBook`, …), `src/lib/photo-book-album.ts` and `components/photo-book/album-photos.ts` find the album's photos, and `apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
