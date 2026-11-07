# Portfolio Lucky

The portfolio's **Lucky** page (`/lucky`, `routes/lucky.tsx`) shows a few rows of photos picked at random. It's in the
site menu, after Color, but has no tile on the [homepage](portfolio-homepage.md).

Its **Show filters** panel is the Grid's: the filters in [Portfolio Filters](portfolio-filters.md), the camera filters
and the **Colors** button. They narrow the pool the photos are picked from, so "Japan, 2023, mostly blue" gives random
blue photos from that trip. The count beside the title says how many were picked out of how many, such as "15 random
of 320 photos". Clicking a photo opens the [photo viewer](photo-viewer.md), which moves through the picked photos.

## Whole rows

The dropdown offers whole rows, 1, 2, 3 (the default), 4, 6 or 8, kept as `?rows=` (left out for 3), and labels each
with the number of photos it holds, such as "15 photos (3 rows)", so the last row is never half empty
(`lib/use-lucky-draw.ts`).

- **Square** tiles (the default): a row holds as many tiles as the Grid's Square columns at the window's width and
  size (see [Portfolio Grid](portfolio-grid.md#square)), so 3 rows of Medium tiles are 15 photos on a laptop and 6 on a
  phone. Resizing the window changes the counts.
- **Natural** tiles (`?view=natural`): each photo at its own aspect ratio, laid out in justified rows the way the
  Grid's are (see [Portfolio Grid](portfolio-grid.md#natural)), and the first rows are shown. Rows hold different
  numbers of photos, so the dropdown's counts are worked out from the layout.

The eye button's **Size** and **Show info** work as they do on the Grid, and change how many photos fit in a row.

## Shuffle

The pool is shuffled in a random order (`lib/lucky.ts`) and the page shows the first rows of it. **Shuffle** shuffles
again, and so does opening the page. Opening a photo, picking more rows or changing the size keeps the same order, so
more rows add photos after the ones already shown. Changing a filter shuffles the new pool.

The order isn't kept in the URL, so a link to Lucky gives whoever opens it their own photos, with the same filters,
shape and rows.

> **Frontend analogy:** the shuffle is like `lodash.shuffle` with a seeded random generator whose seed sits in
> `useState`. Re-rendering with the same seed and pool gives the same order, and **Shuffle** just sets a new seed. The
> rows are then `order.slice(0, rows * columns)` for square tiles, or the first few rows of the natural layout.
