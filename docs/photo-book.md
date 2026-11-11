# Photo Book

`/photo-book`, **Photo Book** under **Publish** in the sidebar, is for roughing out a photo book before laying it out
for real in the book maker's own software: which photos go on which page, in what layout, and what their captions
say. The pages are only a sketch (a 4:5 page with rough proportions), not the printed size, so they're for reference
while placing the photos and captions by hand.

## Books

The bar at the top picks the book to work on (kept in the address as `?book=<id>`, the first book when left out),
**New book** names and makes another (its ID is made from the name, as caption templates' are), and **Remove book**
removes the open one after asking. Under it, **Name** renames the book and **Captions from** picks the
[caption template](caption-templates.md) its captions are filled in with.

## Pages

**Add page** at the end of the pages asks for the new page's layout:

- **Full page:** one photo over the page, its caption at the bottom.
- **Two photos on the left:** two photos down the left side, each with its caption beside it on the right.
- **Two photos on the right:** the same, mirrored: photos on the right, captions on the left.

Pages are shown two to a row, like spreads. Above each page, its number, its layout's three buttons (to switch it; a
photo past the new layout's places comes off the page), the **H** button that adds or takes off a title above the top
photo (typed on the page itself), the arrows that move it earlier or later, and the bin that removes it.

## The photo drawer

**Photos** beside **Saved for Commit** opens and closes a drawer to the right of the pages (under them on a narrow
screen), like the [Instagram calendar's](publish.md#photo-drawer). It lists every photo file, as the Instagram calendar
reads them (in flight ones too, and not the [Undecided](photos-in-flight.md#undecided) ones), newest taken first,
with:

- a search by title or file name,
- **Show photos already in the book**, off at first, so each photo is used once,
- **Show filters**, the [portfolio Grid's filters](gallery.md#the-portfolio-grids-filters) (places, groups, when,
  gear and settings, visuals), kept in the address under the portfolio's own names as on the Gallery.

Drag a photo onto any place on a page, or click it to fill the first empty place. A photo dragged from one place to
another moves there with its caption, swapping with the photo already there; one dragged from a page onto the drawer
comes out of the book. The × on a photo also takes it out.

> **Frontend analogy:** the drawer and the pages share one HTML5 drag type that carries the photo file's path, like
> `dataTransfer.setData("text/uri-list", …)`; each drop target decides what that path means for it.

## Captions

Each photo's caption is filled in from its data with the book's caption template, the same templates and placeholders
the Photo page's **Generate** uses for social media posts, including changes not committed yet. With no template
picked, the book uses the first template for the **Photo Book** platform, or else the first one for any platform.
Typing in a caption keeps what's typed instead, and **From template** under it goes back to the template's.

## The file

Each book is one file, `photobooks/<id>.json`, and **Commit** combines them into `photobooks/PHOTOBOOKS.json`, as it does
caption templates. Every change on the page is saved as a [change waiting for Commit](pending-changes.md)
(`PUT /api/photobooks/<id>`, `DELETE /api/photobooks/<id>`) under a second after the last one, so typing a caption saves
once; the note beside **Photos** says **Saving…** until it has.

```json
{
  "id": "korea-2026",
  "name": "Korea 2026",
  "template": "",
  "pages": [
    {
      "id": "page-1",
      "layout": "full",
      "title": "Seoul",
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }]
    }
  ]
}
```

- **`template`** is the caption template's ID, or `""` for the default one.
- **`layout`** is `full`, `pair-left` or `pair-right`; the backend fills or cuts `slots` to the layout's 1 or 2.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the
  template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes (`placePhoto`, `setLayout`, …), and
`apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
