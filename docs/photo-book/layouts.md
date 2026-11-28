# Photo book layouts

The **Layouts** tab lists the built-in layouts, then the **Standard layouts** every book can use, then **This book's layouts**, each with how many pages have it. The picked one is drawn on the right as a page in the book's shape, with the album's photos, their captions from the caption template and a title; **Other photos** tries the next few photos of the album. Each frame gets the next photo of its shape: landscape photos in landscape frames and portrait ones in portrait frames (from the photo file's `width` and `height`, a photo within 5% of square suiting either). A square frame or one that fills its room takes any photo, and when the album has no photo of a frame's shape left, the next one of any shape fills it. The left and right pages of a book's own layout never repeat a photo. The page is cut off at its edge, as the printed one would be, so text that doesn't fit shows it.

Built-in layouts stay as they are. The copy button beside any layout (or **Customize** under a built-in one) makes a layout of the book's own from its settings, named after it, to change:

- **Photos:** 1 to 4.
- **Arrange the photos:** one under another, or side by side.
- **Photo size:** landscape 3:2, portrait 2:3, square, **Custom ratio** (a width and height typed in, such as 4 : 5, or one of the common ratios under them: 4:5, 5:4, 4:3, 3:4, 16:9, 9:16, 2:1), or **Fill the room**, which gives each photo all the room it has and crops it to fill.
- **Title and captions:** on the left, right, above or below the photos, **Together in one column** or **Beside each photo**, and where they sit in their room (top, middle or bottom).
- **Page title:** **With the captions** puts the title in the text, above the captions (beside each photo, above the first one's caption); **Across the top** puts it above the photos and their text, across the page; **None** leaves titles off this layout's pages. A layout made before has the title with the captions when they're in one column and across the top when each is beside its photo.
- **Line the text up with:** **The photo's room** (the start) lines the text up with all the room the photos are given, which can leave a gap between a photo kept in its shape and the text sitting at the room's bottom. **The photo itself** lines it up with the photos as drawn, so a caption that sits at the bottom ends level with its photo's bottom edge, and one above or below the photos starts and ends where they do. With **Fill the room** the two are the same.

> **Frontend analogy:** a photo kept in its shape is `width: min(100cqw, 150cqh)` inside its room, so the room's edges and the photo's differ, and plain CSS can't line a sibling up with that. **The photo itself** measures the photos with a `ResizeObserver` and gives the text room a `margin-top` and `height` (or `margin-left` and `width`) that match them.

- **Room for the text**, **Gap** and **Margin**: shares of the page, as sliders.
- **Print offset, left (Blurb only)** and **Print offset, right (Blurb only)**: extra room added to **Margin** at that edge only in **PDF for Blurb**, such as more room at the binding. **Save as PDF** and **Save as image** leave them out. On the screen they show while **Preview** is on **Print (Blurb)** ([Print or PDF preview](cover.md#print-or-pdf-preview)).

## Left and right pages

A book's own layout is previewed as a left page (even) and a right page (odd) side by side. **Left-hand pages** says how it draws the pages that land on the left of the open book:

- **Mirrored** (new layouts start this way): the same settings with the text and the print offsets on the other side, so text on the left of a right page goes on the right of a left page, and a left print offset on a right page (at the binding) is a right one on a left page.
- **Same:** the same settings on both sides.
- **Own settings:** left pages have settings of their own, starting from the mirrored ones; **Settings for** picks which side the fields below change. Both sides always hold the same number of photos.

A page in the book is on the side its page number gives. One not in the book is drawn as a right page, or, in a spread, the first page on the left and the second on the right, as it would open. Built-in layouts already come in left and right pairs, so they draw the same on either side.

## Standard layouts

A layout made in one book can be used in every book. **Save as standard layout**, under one of the book's own layouts' settings, saves a copy of it to the standard layouts and links the book's layout to it. Every book's **Layouts** tab then lists it under **Standard layouts**, saying whether that book has it yet; picking it previews it on the book's pages, and **Add to this book** (or the **+** beside it) gives the book its own copy, linked to it, to use on **Photo Pages** and change like any of the book's layouts.

Once a book's layout is linked, the button reads **Update standard layout**: it asks first, then replaces the standard layout's settings with this layout's. Books that already added it keep their copy as it is, so a change to a standard layout never moves pages in a book that's done. **Remove from standard layouts** asks first, and books keep their copies; a copy whose standard layout is gone saves as a new one.

The standard layouts are one file, `booklayouts/standard.json` (combined into `BOOKLAYOUTS.json`), saved as a change waiting for Commit like the books are, so they're the same in every browser: `{ id: "standard", layouts: [the same fields as a book's layouts, without standard], hiddenLayouts: [built-in layout IDs] }`. `PUT /api/booklayouts/standard` saves it; `apps/client-pipeline/src/lib/photo-book-standard.ts` makes the changes and `apps/be-pipeline/internal/github/booklayouts.go` checks them as a book's layouts are checked.

> **Frontend analogy:** a standard layout is like a component in a shared design system package, and adding it to a book is copying it into the app (as shadcn/ui does) rather than importing it: the book owns its copy, and **Update standard layout** is pushing a change back to the package.

## Hiding built-in layouts

The eye beside each built-in layout hides it from this book's **Photo Pages**' layout buttons and **Add page**, so a book that uses its own layouts doesn't offer the built-in ones too. **Hide in every book**, under a built-in layout's settings, hides it from every book's **Photo Pages** instead, kept in the standard layouts file; its row says **Hidden in every book**. A hidden layout stays in the list, faded, to show again; a page that already has it keeps it (and its button) until it's switched.

Every change shows on the preview at once and is saved as a change waiting for Commit. The book's layouts show up on **Photo Pages** after the built-in ones, in each page's layout buttons and **Add page**. A layout that holds fewer photos now takes the extra ones off its pages; **Remove layout** asks first when pages have it, and they become full pages.

> **Frontend analogy:** a built-in layout is a hand-written component; a book's layout is data fed to one generic component, like a CMS block whose props (flex direction, `flex-basis`, `gap`, padding, `aspect-ratio`) come from a JSON file. Sizes are in `cqw`, so the preview and the small pages on the other tabs look the same.

**Preview** (**PDF** or **Print (Blurb)**), under the preview, picks which version the pages show ([Print or PDF preview](cover.md#print-or-pdf-preview)), and **Show bleed and safe boundary** beside it draws Blurb's bleed and safe boundary over the left and right pages ([Bleed and safe boundary guides](cover.md#bleed-and-safe-boundary-guides)).
