# Printing

The pipeline's **Printing** section in the sidebar, between Publish and Configuration, checks how clear a photo will be printed at a size (**Print Quality**, `/printing`) and lists the photos waiting to be printed (**Print Queue**, `/print-queue`). Their parts are in `apps/client-pipeline/src/components/printing/`, and the math is `lib/print-quality.ts`.

## Print size

Both pages share one size picker at the top: a common size (4 × 6 in up to 24 × 36 in, Letter, and A5 to A2 in centimeters) or **Custom** once the width or height is typed, the unit (**in** or **cm**), and how the photo meets the paper:

- **Crop to fill**: the photo covers the whole paper, and whatever sticks out past it is cropped away. The side that runs out first sets the scale.
- **Fit whole photo**: the whole photo is on the paper, with blank borders where their shapes differ. The side that reaches the paper's edge first sets the scale.

Which way the paper is turned doesn't matter: it's turned to match the photo, so a landscape photo prints on landscape paper. The size and fit are kept in this browser's `localStorage` under `pipeline-print-choice`, so they stay set after a reload and on the other page.

## Print Quality

Pick a photo from the grid (search by title or file name), and its card shows:

- its **pixels per inch** on the paper, from its original's `width` and `height` in its photo JSON, with a rating: **Excellent** at 300 and up, **Good** from 200, **Fair** from 150, and **Poor** below that;
- the paper drawn to its shape with the photo on it, cropped or with its borders, so the crop can be seen;
- the original's size in pixels, the paper's size, how much of the photo is cropped away (or of the paper left blank), and the largest print it makes at 300 and at 200 pixels per inch.

Every tile in the grid shows its own rating at the chosen size too, so changing the size shows at a glance which photos still print well. The photo picked is in the address (`/printing?photo=DSCF4800.jpg`), so a tile on Print Queue links straight to its check. A photo whose JSON has no `width` and `height` says so; Update Data's **Missing fields** fills them in.

> **Frontend analogy:** pixels per inch is like `devicePixelRatio` in reverse. A 300 ppi print packs 300 of the photo's pixels into each inch of paper, as a "3x" screen packs three device pixels into each CSS pixel; fewer, and each pixel is blown up big enough to see.

The ratings follow the usual printing guidance: 300 ppi is the standard for photo prints seen up close, around 200 still looks sharp at arm's length, and big prints seen from across a room get away with 150. The Photo Book's dpi marks use the same 300 ([The book](photo-book/the-book.md)).

## Print Queue

One album is the print queue: pick it under **Print queue album**, and every photo in it, or in an album inside it, is listed in the album's order, each with its rating at the chosen size and a link to its check. Queue a photo by adding it to that album, from the Gallery or the album's page, and take it out the same way once it's printed. The album picked is kept in this browser's `localStorage` under `pipeline-print-queue-album`; it isn't committed anywhere, since it only matters to this pipeline.
