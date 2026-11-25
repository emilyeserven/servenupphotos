# Photo Book

`/photo-books`, **Photo Books** under **Publish** in the sidebar, is for roughing out a photo book before laying it out for real in the book maker's own software: which photos go on which page, in what layout, and what their captions say. The pages are drawn like the printed books (black, in Helvetica: a bold uppercase page title, each caption's first line bold and the lines under it small) in the shape the book's page size gives them, but only as a sketch, for reference while placing the photos and captions by hand. Text sizes are in `cqw`, shares of the page's width, so they scale with it.

## Books

**Photo Books** lists every book as a card, with the album its photos come from, how many pages are in the book (and how many more could be used), and how many photos are on them; each card opens the book's own page, as the Trips do. **New book** names and makes another (its ID is made from the name, as caption templates' are) and opens it. An old `/photo-book` link opens the list, or the book its `?book=<id>` names.

On a book's page, **All photo books** goes back to the list. Under it, three tabs, each a page of its own with a line under the tabs saying what it's for:

- **Info** (`/photo-books/<id>/info`): the book's name, album, caption template, page size and page budget.
- **Layouts** (`/photo-books/<id>/layouts`): trying out page layouts at the book's page size.
- **Photo Pages** (`/photo-books/<id>/pages`, where the book opens): making photo pages that could be used, and linking them into spreads.
- **Book** (`/photo-books/<id>/book`): putting the pages that will be used in order, adding other pages, and paging through the book.

## Info

**Name** renames the book, **Photos from** picks the album its photos come from, **Captions from** picks the [caption template](caption-templates.md) its captions are filled in with, and **Remove book** removes it after asking.

**Page size** takes the page's width and height in inches, centimeters, millimeters, points or pixels, starting at BookWright's large landscape page, 12.5 × 10.625 in. Only the shape is used: every page on every tab is drawn with width over height as its `aspect-ratio`, shown beside the fields as a small black page. A side that isn't a number more than 0 isn't saved.

**Page budget** sets a **Target** and a **Max** page count, each saved as it's typed; an empty box isn't set, and a target over the max isn't saved. They count printed pages: a spread is two, and other pages and the blank placeholder pages the Book tab adds count too. On **The book**, above the preview, a bar shows the pages in the book against them: the count, how many pages to go to (or past) each, the target marked on a bar that runs to the max, green once the target is reached and red with a warning past the max. A book with no budget shows none of it.

## Layouts

The **Layouts** tab lists the built-in layouts, then **This book's layouts**, each with how many pages have it. The picked one is drawn on the right as a page in the book's shape, with the album's photos, their captions from the caption template and a title; **Other photos** tries the next few photos of the album. The page is cut off at its edge, as the printed one would be, so text that doesn't fit shows it.

Built-in layouts stay as they are. The copy button beside any layout (or **Customize** under a built-in one) makes a layout of the book's own from its settings, named after it, to change:

- **Photos:** 1 to 4.
- **Arrange the photos:** one under another, or side by side.
- **Photo size:** landscape 3:2, portrait 2:3, square, **Custom ratio** (a width and height typed in, such as 4 : 5, or one of the common ratios under them: 4:5, 5:4, 4:3, 3:4, 16:9, 9:16, 2:1), or **Fill the room**, which gives each photo all the room it has and crops it to fill.
- **Title and captions:** on the left, right, above or below the photos, **Together in one column** or **Beside each photo**, and where they sit in their room (top, middle or bottom).
- **Room for the text**, **Gap** and **Margin**: shares of the page, as sliders.

### Left and right pages

A book's own layout is previewed as a left page (even) and a right page (odd) side by side. **Left-hand pages** says how it draws the pages that land on the left of the open book:

- **Mirrored** (new layouts start this way): the same settings with the text on the other side, so text on the left of a right page goes on the right of a left page.
- **Same:** the same settings on both sides.
- **Own settings:** left pages have settings of their own, starting from the mirrored ones; **Settings for** picks which side the fields below change. Both sides always hold the same number of photos.

A page in the book is on the side its page number gives. One not in the book is drawn as a right page, or, in a spread, the first page on the left and the second on the right, as it would open. Built-in layouts already come in left and right pairs, so they draw the same on either side.

### Hiding built-in layouts

The eye beside each built-in layout hides it from the **Photo Pages**' layout buttons and **Add page**, so a book that uses its own layouts doesn't offer the built-in ones too. A hidden layout stays in the list, faded, to show again; a page that already has it keeps it (and its button) until it's switched.

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

> **Frontend analogy:** each place is a CSS size container (`container-type: size`) whose photo is `min(100cqw, 150cqh)` wide with `aspect-ratio: 3 / 2`, so it's as big as it can be without stretching, whichever side runs out first. Each photo loads the smallest of its resized versions that's at least as wide as it's drawn, times the screen's pixel density, so the large preview on **The book** stays sharp and the small ones stay light.

> **Frontend analogy:** that's `srcset` with `w` descriptors and a `sizes` set from the place's measured width (a `ResizeObserver`), rather than one fixed thumbnail URL.

Pages have no numbers here. Above each page, its name, typed in (**Untitled page** until it has one), its layout's buttons (to switch it; a photo past the new layout's places comes off the page), the **H** button that adds or takes off a title (typed on the page itself), and the bin that removes it. Clicking a caption types over it.

**Move to…** on each photo page or spread in **Edit pages** moves it to a position you type among the photo pages, 1 first, a spread moving as one; a number past either end puts it first or last. Like dragging, it doesn't change the book's own order.

**Sort by book order**, beside the views, puts the photo pages in the order **The book** has them, the ones not in the book after them in the order they were; it says **In book order** once they are. **Show pages in the book**, on to start, can be turned off to see only the pages and spreads not in the book yet. Both show only once something is in the book.

**Edit pages** and **Grid to reorder**, above the pages, switch views. The grid shows every photo page and spread as a small preview, numbered in order and marked **In book**; drag one onto another to put it before that one, or onto the box at the end. A spread moves as one, and the book's own order (on **The book**) doesn't change. Clicking one opens **Edit pages** scrolled to it, and clicking its number opens **Move to…**. Check two or more with the box by their names and **Set as alternates**, above the grid, puts them in one alternates group, bringing along any group one was already in.

Two round buttons at the bottom right scroll smoothly to either end of the page: **Jump to bottom**, shown while the page is more than a little way from its end, and **Back to top** above it, shown once it's scrolled down a little. They're the portfolio's **Back to top** button, which can go either way. A second **Add page**, at the right end of the row above the pages, adds a page the same way as the one at the end and scrolls down to it.

### Alternates

**Alternates**, above each page or spread, makes others alternates of it: two or more versions of the same part of the book, grouped and lettered (**Alternate A**). Its flyout lists the group; **Pick** keeps that one and hides the others from Photo Pages (they're kept, marked **Alternate A · hidden**), and in the book the picked one takes the place of the first of its group there, the others coming out. **Show hidden alternates**, beside the views, shows the hidden ones again, to pick another; **Show all again** undoes the pick; **Leave group** takes one out (a group left with one ends). A spread is an alternate as one.

### Spreads

**Link with next page**, above a page, links it with the photo page after it into a two-page spread, shown side by side across the row with **Unlink** above it; a spread's pages always follow each other, so the arrows beside it move the page or the whole spread one place earlier or later among the photo pages, to line up the two to link. A page before a spread can't link to it. **In book** marks a page or spread that's in the book. Its tags show beside that as chips (the × takes one off), and **Add tag** opens a flyout with this book's tags to add with a click and a box for a new one. Tags belong to the book: the ones offered are the ones on its pages, and no other book shares them. Removing one page of a spread leaves the other on its own, in the book where the spread was.

## The book

The **Book** tab has three parts, as the book makers' own software does:

- **The preview**, as large as fits, keeping the pages' shape: the book as it opens, two facing pages at a time, with **‹** and **›** at the two ends of the strip under it (so they stay put while paging) to page through, where it is (**Pages 2–3 of 12**) and the pages' names, and **Preview Mode**. Page 1 is a right page, facing the inside front cover, and the last page faces the inside back cover (both drawn plain grey).
- **Edit mode**, in the strip under the preview, lets photos be dragged from one place to another on the two pages shown: dropped on a filled place they swap, on an empty one they move, each with its caption. Nothing else changes there (titles, captions and the buttons on photos don't respond); **Done editing** turns it off.
- **Blank pages:** a spread always opens left and right, so one that would start on a right (odd) page gets a blank page before it, and a book with an odd number of pages gets one at the end, as a printed book has an even number. They're drawn striped and dashed, marked **Blank page · placeholder**, take page numbers (so the pages after them change side) and count toward the page budget, but are never saved: moving pages changes where they go.
- **Used page spreads**, beside it (under it on a narrow screen): the pages and spreads in the book, in order, top to bottom, each a small preview with its page numbers and name. Click one to show it in the preview; drag one onto another to put it before it, or onto the box at the end; the arrows move it and **×** takes it out, leaving it among the ones that could be used. The panel's button collapses it to a thin rail. Its list scrolls on its own (staying in view beside the preview on a wide screen), so a long book doesn't make the page longer. Pointing at one shows an eye button that shows it in the preview, as clicking its picture does.
- **All pages and spreads**, a drawer along the bottom of the window: every photo page and spread made on **Photo Pages**, then the other pages, each a small preview, dimmed and marked **In book** when it's in. Drag one into **Used page spreads**, or its **+** adds it at the end; drag one from **Used page spreads** onto the drawer to take it out. Its heading opens and closes it. The tag dropdown beside the drawer's name, once it's open, shows only the pages and spreads with that tag, to find a group of pages again, such as "Seoul" or "maybe". Tags are set on **Photo Pages**; the drawer doesn't show each one's tags, to keep it short. The layout dropdown beside it shows only the pages and spreads with a page in that layout: the built-in and the book's own layouts in use, in the order the pickers list them, and **Other pages**. **Show ones in the book**, beside the dropdowns and on to start, can be turned off to list only the pages and spreads not in the book yet.

When a photo is on more than one page in the book, each of them is marked **Also on page …** on **Photo Pages**.

### Print resolution

Each photo is checked against the book's page size from **Info**: its original's pixel width over the inches it covers on the printed page, once cropped to fill its place (so a photo cropped to a narrow place prints larger than the place). Below 300 dpi, the photo is marked with its resolution in red (**170 dpi**) on **Photo Pages**, and **The book** lists every such photo in the book under the preview, with its page number and page name; clicking one shows that page. A page size in pixels has no printed size, so it isn't checked, and the Book tab says so.

> **Frontend analogy:** the places are sized by CSS, so rather than copy every layout's flexbox math into TypeScript, each place measures itself with a `ResizeObserver` against its page's sheet (the same ratio at any zoom, so a small preview measures as well as a full page) and writes its dpi to a small Zustand store, which the Book tab's list reads. `lib/photo-book-dpi.ts` has the math (`printDpi`, `lowResolution`).

### Other pages

Other pages are pages without photos: one the publisher requires, a bio page, or anything else. For now each shows only its name, as a placeholder. Type a name in the drawer and **Add other page** makes one and adds it at the end of the book; each has a bin in the drawer that removes it. They're not on **Photo Pages** and are never part of a spread.

### Preview Mode

**Preview Mode** collapses the app's sidebar, **Used page spreads** and the drawer, and shows the preview over the whole window, with nothing around it, as large as the window lets it be. **Esc** or **Leave Preview Mode** turns it off and opens the sidebar again if it was open; the arrow keys page through the book. Opening either panel leaves it too.

> **Frontend analogy:** the drawer and **Used page spreads** share one HTML5 drag type carrying the page or spread's ID, so each is both a source and a drop target, like a sortable list fed from a palette. The preview's views are derived state: the book's order grouped one way or the other, recomputed each render rather than stored.

### Save as PDF

**Save as PDF**, above the preview, draws every page of the book in its order, each on its own sheet of paper the book's page size from **Info**, and opens the browser's print dialog; pick **Save as PDF** there to make the file. Page 1 is a right page and they alternate from there, so a custom layout's left and right looks print as they show in the preview. Blank pages print blank, and the inside covers are left out, since they aren't pages of the book. Photos are loaded at about three times the size they're drawn, close to 300 dpi on paper (as large as the photo's biggest version allows), and the dialog waits for them, up to 30 seconds. Nothing that's only for editing is printed: no "Drop a photo here", dashed outlines, empty caption or title placeholders, or dpi marks.

> **Frontend analogy:** it's `window.print()` on a portal of the pages, with `@page { size: 12.5in 10.625in; margin: 0 }`, `break-after: page` on each page and a print media query that hides the rest of the app. A React context tells each photo it's printing, so its `<img>` loads eagerly with a larger `sizes`.

## The photo drawer

**Photos**, on the **Photo Pages** tab, opens and closes a drawer to the right of the pages (under them on a narrow screen), like the [Instagram calendar's](publish.md#photo-drawer). It lists the photos of the book's album and the albums inside it (Smart Albums by their rules), in the album's order as the portfolio shows it, with changes waiting for Commit, and not the [Undecided](photos-in-flight.md#undecided) ones. Until an album is picked it asks for one. It has:

- a search by title or file name,
- **Filter** beside it, with **All**, **Horizontal**, **Vertical** and **Square** under it as a quick orientation filter (the same `?orientation=` as the Visuals picker in the flyout), and **Filter** opens the portfolio Grid's filters (places, album, tag, genre, camera, lens, the setting and time of day sliders, and colors, as on the [Gallery](gallery.md)) in a flyout, saying how many are set; the photos stay in the album's order, and the filters stay in the URL,
- **Show photos already in the book**, off at first, so each photo is used once.

A photo already on a page (in the book or not) is faded in the drawer, and shows fully on hover, so the ones still to place stand out. Pointing at a faded photo shows a small arrow button that scrolls to the first page drawn with it (its outline flashes); each click after goes to the next one, back to the first after the last. Once pages have [tags](#the-book), **Fade photos on**, a dropdown under the checkbox, picks whose photos are faded: **All pages**', or only the pages with one tag, so with one run of pages tagged "by place" and another "by theme", each run's photos can be placed without the other's fading them.

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
      "tags": ["Seoul"],
      "slots": [{ "photo": "apps/portfolio/src/data/photos/DSCF4800.json", "caption": null }]
    },
    { "id": "page-2", "name": "Seoul pair", "layout": "pair-left", "title": null, "slots": […] },
    { "id": "page-3", "name": "Bio", "layout": "other", "title": null, "slots": [] }
  ],
  "order": ["page-3", "page-1"],
  "hiddenLayouts": ["pair-left"]
}
```

- **`template`** is the caption template's ID, or `""` for the default one.
- **`album`** is the ID of the album the book's photos come from, or `""` (or missing, in a book made before) while none is picked.
- **`budget`** is the page budget from **Info**, `{ target, max }`, each a whole number of printed pages up to 500 with `target` no more than `max`; a number not set is left out, and so is a budget with neither.
- **`size`** is the page size from **Info**, `unit` one of `in`, `cm`, `mm`, `pt` or `px`; a book without one uses 12.5 × 10.625 in.
- **`layout`** is `full`, `pair-left`, `pair-right`, `verticals-left` or `verticals-right`, `other` for an other page, or the ID of one of the book's `layouts`; the backend fills or cuts `slots` to the layout's count (none for `other`).
- **`layouts`** are the book's own layouts from the **Layouts** tab, each `{ id: "custom-<n>", name, photos (1–4), arrange: "stack" | "row", shape: "landscape" | "portrait" | "square" | "ratio" | "fill", ratio: { width, height } (only with "ratio", each more than 0 and at most 100), text: "left" | "right" | "above" | "below", captions: "column" | "photo", textShare (10–60), align: "start" | "center" | "end", gap (0–20), margin (0–20), leftPages: "mirror" | "same" | "own", left: { the same settings but id, name, photos and leftPages } (only with "own") }`, the numbers in percent of the page; left out while there are none. A layout without `leftPages` (made before) draws the same on both sides. A page whose layout isn't there is refused.
- **`hiddenLayouts`** are the IDs of the built-in layouts hidden on **Layouts**, left out when none is.
- **`name`** is the page's name, left out until it has one.
- **`alternates`** is the page's alternates group, such as `alt-1`, shared by a spread's pages, and **`hidden`** is `true` on one that lost to the one picked; the backend keeps `hidden` only on an alternate. Both are left out when not set.
- **`tags`** are the page's tags from **Photo Pages**, trimmed, each once, at most 20; left out when it has none.
- **`linkNext`** is `true` on a photo page linked with the photo page after it into a spread, in the order of `pages`.
- **`pages`** is every page made for the book, and **`order`** the IDs of the pages and spreads in the book, in its order, a spread listed by its first page. A book made before `order` has none, and then every page is in it, in their order; adding a page writes it. A spread's second page listed too (as **Import Book** writes every page) counts as the spread.
- **`title`** is `null` for a page without one.
- **`photo`** is the photo file's path, or `""` for an empty place. **`caption`** is `null` to fill it in from the template, or the text typed instead.

`apps/client-pipeline/src/lib/photo-book.ts` makes the changes to a page (`placePhoto`, `setLayout`, `renamePage`, …), `src/lib/photo-book-layouts.ts` the book's layouts (`addLayout`, `changeLayout`, `removeLayout`, `sideLook`, `setLeftPages`, `setHidden`), `src/lib/photo-book-order.ts` the changes to which pages make spreads and which are in the book (`bookUnits`, `addToBook`, `setLinkNext`, `bookViews`, …), `src/lib/photo-book-album.ts` and `components/photo-book/album-photos.ts` find the album's photos, and `apps/be-pipeline/internal/github/photobooks.go` checks and saves the files.
