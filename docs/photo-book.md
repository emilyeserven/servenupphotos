# Photo Book

`/photo-books`, **Photo Books** under **Publish** in the sidebar, is for roughing out a photo book before laying it out for real in the book maker's own software: which photos go on which page, in what layout, and what their captions say. The pages are only a sketch (a landscape page, 11:8.5, with rough proportions), not the printed size, so they're for reference while placing the photos and captions by hand.

## Books

**Photo Books** lists every book as a card, with the album its photos come from, how many pages it has (and how many of them are left out), and how many photos are on them; each card opens the book's own page, `/photo-books/<id>`, as the Trips do. **New book** names and makes another (its ID is made from the name, as caption templates' are) and opens it. An old `/photo-book` link opens the list, or the book its `?book=<id>` names.

On a book's page, **All photo books** goes back to the list, **Name** renames the book, **Photos from** picks the album its photos come from, **Captions from** picks the [caption template](caption-templates.md) its captions are filled in with, and **Remove book** removes it after asking.

## Pages

**Add page** at the end of the pages asks for the new page's layout:

- **Full page:** one photo over the page, its caption at the bottom.
- **Two photos on the left:** two photos down the left side, each with its caption beside it on the right.
- **Two photos on the right:** the same, mirrored: photos on the right, captions on the left.
- **Two portrait photos on the left:** two portrait photos side by side on the left, their captions stacked on the right, in the photos' order.
- **Two portrait photos on the right:** the same, mirrored.

Each photo place keeps its shape whatever room the page gives it: 3:2 for the landscape places, 2:3 for the portrait ones, as large as fits, with the photo cropped to fill it.

> **Frontend analogy:** each place is a CSS size container (`container-type: size`) whose photo is `min(100cqw, 150cqh)` wide with `aspect-ratio: 3 / 2`, so it's as big as it can be without stretching, whichever side runs out first.

Pages are shown one to a row, or two like spreads on a very wide screen. Above each page, its number, its layout's buttons (to switch it; a photo past the new layout's places comes off the page), the **H** button that adds or takes off a title above the top photo (typed on the page itself), the eye that leaves the page out of the book or puts it back, the arrows that move it earlier or later, and the bin that removes it.

## Pages left out

A page left out of the book stays on the page, faded with a dashed border and called **Left out** instead of a number, so other ways of laying out the same photos can be kept side by side, such as one run of pages sorted by place and another by theme, and the one to use put in the book with its eye. Pages left out aren't numbered, aren't filled by clicking a photo, and don't count as using their photos, so a photo can be on a page in the book and on one left out. When a photo is on more than one page in the book, each of them is marked **Also on page …**.

## The photo drawer

**Photos** beside **Remove book** opens and closes a drawer to the right of the pages (under them on a narrow screen), like the [Instagram calendar's](publish.md#photo-drawer). It lists the photos of the book's album and the albums inside it (Smart Albums by their rules), in the album's order as the portfolio shows it, with changes waiting for Commit, and not the [Undecided](photos-in-flight.md#undecided) ones. Until an album is picked it asks for one. It has:

- a search by title or file name,
- **Show photos already in the book**, off at first, so each photo is used once.

Drag a photo onto any place on a page, or click it to fill the first empty place on a page in the book. A photo dragged from one place to another moves there with its caption, swapping with the photo already there; one dragged from a page onto the drawer comes off that page. The × on a photo also takes it off. A photo from the drawer always goes in as a new one, so with **Show photos already in the book** on, the same photo can be put on a second page.

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
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }],
      "leftOut": false
    }
  ]
}
```

- **`template`** is the caption template's ID, or `""` for the default one.
- **`album`** is the ID of the album the book's photos come from, or `""` (or missing, in a book made before) while none is picked.
- **`layout`** is `full`, `pair-left`, `pair-right`, `verticals-left` or `verticals-right`; the backend fills or cuts `slots` to the layout's 1 or 2.
- **`leftOut`** is `true` for a page left out of the book.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes (`placePhoto`, `setLayout`, `setLeftOut`, …), `src/lib/photo-book-album.ts` and `components/photo-book/album-photos.ts` find the album's photos, and `apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
