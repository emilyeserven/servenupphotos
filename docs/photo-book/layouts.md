# Photo book layouts

The **Layouts** tab lists the built-in layouts, then **This book's layouts**, each with how many pages have it. The picked one is drawn on the right as a page in the book's shape, with the album's photos, their captions from the caption template and a title; **Other photos** tries the next few photos of the album. Each frame gets the next photo of its shape: landscape photos in landscape frames and portrait ones in portrait frames (from the photo file's `width` and `height`, a photo within 5% of square suiting either). A square frame or one that fills its room takes any photo, and when the album has no photo of a frame's shape left, the next one of any shape fills it. The left and right pages of a book's own layout never repeat a photo. The page is cut off at its edge, as the printed one would be, so text that doesn't fit shows it.

Built-in layouts stay as they are. The copy button beside any layout (or **Customize** under a built-in one) makes a layout of the book's own from its settings, named after it, to change:

- **Photos:** 1 to 4.
- **Arrange the photos:** one under another, or side by side.
- **Photo size:** landscape 3:2, portrait 2:3, square, **Custom ratio** (a width and height typed in, such as 4 : 5, or one of the common ratios under them: 4:5, 5:4, 4:3, 3:4, 16:9, 9:16, 2:1), or **Fill the room**, which gives each photo all the room it has and crops it to fill.
- **Title and captions:** on the left, right, above or below the photos, **Together in one column** or **Beside each photo**, and where they sit in their room (top, middle or bottom).
- **Page title:** **With the captions** puts the title in the text, above the captions (beside each photo, above the first one's caption); **Across the top** puts it above the photos and their text, across the page; **None** leaves titles off this layout's pages. A layout made before has the title with the captions when they're in one column and across the top when each is beside its photo.
- **Line the text up with:** **The photo's room** (the start) lines the text up with all the room the photos are given, which can leave a gap between a photo kept in its shape and the text sitting at the room's bottom. **The photo itself** lines it up with the photos as drawn, so a caption that sits at the bottom ends level with its photo's bottom edge, and one above or below the photos starts and ends where they do. With **Fill the room** the two are the same.

> **Frontend analogy:** a photo kept in its shape is `width: min(100cqw, 150cqh)` inside its room, so the room's edges and the photo's differ, and plain CSS can't line a sibling up with that. **The photo itself** measures the photos with a `ResizeObserver` and gives the text room a `margin-top` and `height` (or `margin-left` and `width`) that match them.

- **Room for the text**, **Gap** and **Margin**: shares of the page, as sliders.

## Left and right pages

A book's own layout is previewed as a left page (even) and a right page (odd) side by side. **Left-hand pages** says how it draws the pages that land on the left of the open book:

- **Mirrored** (new layouts start this way): the same settings with the text on the other side, so text on the left of a right page goes on the right of a left page.
- **Same:** the same settings on both sides.
- **Own settings:** left pages have settings of their own, starting from the mirrored ones; **Settings for** picks which side the fields below change. Both sides always hold the same number of photos.

A page in the book is on the side its page number gives. One not in the book is drawn as a right page, or, in a spread, the first page on the left and the second on the right, as it would open. Built-in layouts already come in left and right pairs, so they draw the same on either side.

## Hiding built-in layouts

The eye beside each built-in layout hides it from the **Photo Pages**' layout buttons and **Add page**, so a book that uses its own layouts doesn't offer the built-in ones too. A hidden layout stays in the list, faded, to show again; a page that already has it keeps it (and its button) until it's switched.

Every change shows on the preview at once and is saved as a change waiting for Commit. The book's layouts show up on **Photo Pages** after the built-in ones, in each page's layout buttons and **Add page**. A layout that holds fewer photos now takes the extra ones off its pages; **Remove layout** asks first when pages have it, and they become full pages.

> **Frontend analogy:** a built-in layout is a hand-written component; a book's layout is data fed to one generic component, like a CMS block whose props (flex direction, `flex-basis`, `gap`, padding, `aspect-ratio`) come from a JSON file. Sizes are in `cqw`, so the preview and the small pages on the other tabs look the same.

**Show bleed and safe boundary**, under the preview, draws Blurb's bleed and safe boundary over the left and right pages ([Bleed and safe boundary guides](cover.md#bleed-and-safe-boundary-guides)).
