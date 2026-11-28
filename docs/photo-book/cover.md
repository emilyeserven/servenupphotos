# The Cover tab and PDF for Blurb

The **Cover** tab (`/photo-books/<id>/cover`, `components/photo-book/cover-tab.tsx`) makes a book's cover in the style of Serven Up Photos Vol. 3, and **PDF for Blurb** on the Book tab makes the two PDFs Blurb takes to print the book: its pages and its cover.

## The cover

The cover is drawn as Blurb prints it: the back, the spine and the front on one sheet the shape of Blurb's cover PDF (26.681 × 11.625 in for a 78-page Large Landscape hardcover ImageWrap book). Like Vol. 3's, it's a plain background running to every edge, a white spine band, and the words in Helvetica:

- **Title**, one line of the cover a line (`Serven`, `Up`, `Photos` to start), large and bold in the front's top left.
- **Author** (`Emily Serven` to start) in the front's bottom left, and **Volume** (such as `Vol. 3`, empty to start) in italics in its bottom right.
- **Spine**, the text down the spine, reading top to bottom, in the background color; empty to start, for none. The back is left plain.
- The **spine band**, in the text color (white to start), covers the spine and reaches 0.681 in (49 pt) past each fold into the front and back, as the white strip along the spine of Vol. 3's front and back does (`SPINE_BAND`).
- **Background** and **Text**, the colors, black and white to start.

The front's words are placed and sized in shares of the width of the front right of the spine band once Blurb trims it, measured off Vol. 3's cover: the title's capitals 1% below the top and 8% in, each line 17.5% tall with 1.2 lines between them; the author and volume 5.65% tall, their baseline 4.2% above the bottom, the volume 3.5% in from the right (`FRONT_INSETS` in `lib/photo-book-cover.ts`). So the cover keeps Vol. 3's look at any of Blurb's sizes. Each change saves as typed, as a [change waiting for Commit](../pending-changes.md).

The preview draws dashed lines where Blurb trims the cover and where the spine folds. They're only on the screen, never printed.

> **Frontend analogy:** the cover sheet is one `position: relative` box with `aspect-ratio` set to Blurb's cover size; the back, spine and front are absolutely placed boxes in percent of it, and the front's words use `cqw` on a container-query box the size of the trimmed front right of the band, so they scale with it like `vw` scales with the window.

## The front cover in Save as PDF

**Save as PDF** on the Book tab starts with the front cover alone, on a sheet the book's page size, as Serven Up Photos Vol. 3's PDF does: the white spine band down its left edge, 0.681 in wide (49 pt, Vol. 3's; 49 of 900 pt of the page when its size is in pixels), and the front's words placed in the rest by the same shares as on the whole cover (`FrontCoverPage` in `components/photo-book/book-cover.tsx`). The back cover and the spine are left out. **Save spreads as PDF** and **PDF for Blurb** don't add it: Blurb takes the cover as its own PDF.

## Warnings, not rules

Blurb's bleed, margins and safe boundary are only warned about under the preview, never drawn or enforced: nothing is moved to fit them and no marks are printed. The list says how much Blurb trims off each page and the cover, that text should stay 0.25 in inside the trimmed edge (0.5 in at the binding), and which of the front's words sit closer than that. With Blurb's 78-page sizes, the title's top is 0.121 in from the trimmed edge, as on Vol. 3.

## Print or PDF preview

**Preview**, on the Book tab (under the page budget) and the Layouts tab (under the preview), picks which version of the pages the preview shows. **PDF** (the default) draws them as **Save as PDF** and **Save as image** make them: the book's own page size from **Info**, without the layouts' print offsets. **Print (Blurb)** draws them as **PDF for Blurb** prints them: Blurb's page size, with each layout's **Print offset, left** and **right** added to its margins ([Photo book layouts](layouts.md)). The choice is kept in this browser and shared by both tabs; the other tabs always show the PDF version. It never changes what any button saves: each PDF and image is made in its own version. **Show bleed and safe boundary** is separate, and draws its guides over either version.

> **Frontend analogy:** it's like a "print" media query preview in dev tools: the same components, fed a different page size and one extra flag, rather than a second copy of the page.

## Bleed and safe boundary guides

**Show bleed and safe boundary**, a checkbox on the Book tab (under the page budget) and the Layouts tab (under the preview), draws Blurb's guides over every page, as **PDF for Blurb** prints it at Blurb's page size: the bleed Blurb trims off the top, bottom and outside edge shaded red (the left edge of a left page, the right of a right page), and Blurb's safe boundary dashed in blue, 0.25 in inside the trim and 0.5 in from the binding edge. The bleed is how much larger Blurb's page PDF is than the book's page size, or 0.125 in when the size is in pixels (`lib/photo-book-guides.ts`). The checkbox is kept in this browser and shared by both tabs. The guides are only on the screen, never in a PDF or a spread's image, and nothing on the page moves for them.

## PDF for Blurb

**PDF for Blurb**, beside **Save as PDF** on the Book tab, makes two PDFs on the pipeline's backend, as **Save as PDF** does, and downloads both:

- `<id>-blurb-pages.pdf`: every page of the book in its order, each sheet Blurb's page PDF size (12.625 × 10.875 in to start). Each page is drawn at that size, so its background runs to the edge where Blurb trims the bleed, instead of being drawn at the book's page size with a bleed around it. The page count is even, as Blurb asks, since the book adds a blank last page when it's odd ([The book](the-book.md)).
- `<id>-blurb-cover.pdf`: the cover, one sheet Blurb's cover PDF size.

Each PDF measures exactly Blurb's size, to the thousandth of an inch. Chrome rounds a PDF's paper size a little (11.625 in comes out 11.623 in), so the button sends the size it wants with the pages (`width` and `height`, in inches, on `POST /api/photobooks/<id>/pdf`) and the backend sets each page's size back to it (`bookpdf.SetPageSize`).

> **Frontend analogy:** the size is a number in the PDF's text, like a value in a minified bundle; the backend rewrites it in place, padded to the same length, so every offset the file keeps to find its parts still lines up.

If the backend stops part way through sending a PDF (it crashed, restarted, or ran out of time), the button says so, such as "The backend stopped answering /photobooks/korea/pdf", and the backend's terminal says why.

**Save cover PDF for Blurb**, on the Cover tab, makes only the cover's. The browser may ask once to allow the two downloads.

## Blurb sizes

**Blurb sizes** on the Info tab are the sizes, in inches, from Blurb's specifications for the book's size, paper and page count: **Page PDF width** and **height** and **Cover PDF width** and **height** (each "Final, exported PDF should measure"), **Spine width** (the gutter / spine) and **Cover bleed**. They start as a 78-page Large Landscape hardcover ImageWrap book on standard paper. The spine, and so the cover's width, grows with the page count, so make the cover last, once the page count is final. Sizes that leave no room for the cover's front and back aren't saved.
