# Portfolio Grid

The portfolio's Grid (`/grid`, `routes/grid.tsx`) shows every photo with resized versions in R2, newest first, in one of
three views picked at the top right (`?view=`): **Square** tiles (the default), **Natural** tiles, or a **Table**. Its
**Show filters** panel has the filters in [Portfolio Filters](portfolio-filters.md), including the camera filters, and
a **Colors** section (see [Portfolio Color](portfolio-color.md#on-the-grid-page)); they apply to every view. Clicking a
photo opens the [photo viewer](photo-viewer.md).

The tile views share the sort dropdown (newest, oldest, **Recently Added**, color, vividness) and **Show info**, which puts each photo's
title, place, color bar and comment under its tile (`?info=true`).

**Recently Added** (`?sort=added`) puts the photos most recently added to the portfolio first, by their
[`addedDate`](data-model.md#date-added), with photos that have none yet after them, newest first.

## Square

Each photo as the square picked on the pipeline's Photo page, in a grid of 2 to 6 columns as the window widens.

## Natural

Each photo at its own aspect ratio (`?view=natural`), in justified rows (`components/natural-grid.tsx`,
`lib/natural-rows.ts`): a row's tiles are all the same height, and a full row's tiles grow together to fill its width.
Vertical photos (narrower than 0.9 of their height) are gathered into rows of their own, which start tall enough for
each photo to be at least 400px wide (rows of wide photos start 250px tall), so they show larger instead of being squeezed between wide photos. Each row starts with the next photo in
the sort and takes the next photos of the same kind until another wouldn't fit, so photos stay close to their place in
the sort, moved at most a row or so. When too few photos of one kind are left to fill a row, the rest share rows of the
wide height. The last row isn't stretched. No tile grows taller than 90% of the window (`90vh`); a row whose tiles
all reach that is centered rather than stretched.

> **Frontend analogy:** like a CSS `flex-wrap` gallery, but the line breaks are worked out in JavaScript from the
> measured width (a `ResizeObserver`), so each line can hold only one kind of photo and have its own height.

## Table

The **Table** (`?view=table`, `components/photo-table.tsx`) lists every photo as a row, including photos without resized
versions in R2: its thumbnail, title, when it was taken, when it was added to the portfolio (**Added**, a dash until Update Data dates it), its place, camera, lens and camera settings. Clicking a column's
name sorts by it (`?column=…&dir=…`), the **Columns** menu hides columns (`?hide=…`), and the photo viewer moves through
the rows in the table's sort. The tiles' sort and **Show info** are hidden here. Older `/table` links go to this view,
keeping their sort (their `?sort=` becomes `?column=`), columns, filters and open photo (`routes/table.tsx`,
`lib/table-search.ts`).

### View menu

**View** picks how much of each photo's location the **Place** column shows, under **Place names**:

| Choice                  | Shows                                                                       | URL                    |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------- |
| Most specific (default) | The most specific of its places, such as "Geunjeongmun Gate"                | left out               |
| All place names         | Its places as a phrase, such as "Geunjeongmun Gate in Gyeongbokgung Palace" | `?placeDetail=places`  |
| Include city            | Its places and its city                                                     | `?placeDetail=city`    |
| Include state           | Its places, its city and its state                                          | `?placeDetail=state`   |
| Include country         | Its places, its city, its state and its country                             | `?placeDetail=country` |

A photo without places shows its city, state and country (whichever it has). The most specific place is the one inside the most others
(see [Places](places-and-localizations.md#places)). Names are written the way the menu's **Script display** says, and
hovering a place shows its GPS position, and its state and country when the text leaves them out. The column sorts by the text it
shows, in English. The choice stays with the Grid: the menu's links to other views don't carry it.
