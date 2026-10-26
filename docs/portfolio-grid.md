# Portfolio Grid

The portfolio's Grid (`/grid`, `routes/grid.tsx`) shows every photo with resized versions in R2, newest first, in one of
three views picked at the top right (`?view=`): **Square** tiles (the default), **Natural** tiles, or a **Table**. Its
**Show filters** panel has the filters in [Portfolio Filters](portfolio-filters.md), including the camera filters, and
a **Colors** section (see [Portfolio Color](portfolio-color.md#on-the-grid-page)); they apply to every view. Clicking a
photo opens the [photo viewer](photo-viewer.md).

The tile views share the sort dropdown (newest, oldest, **Recently Added**, **Time of Day**, color, vividness) and
the eye button's display options (`components/grid-view-options.tsx`, using the flyout shared with the Map and Timeline,
`components/view-options-button.tsx`):

- **Size** (`?size=`, `lib/grid-size.ts`): how big the tiles are. **Medium** is the default and is left out of the URL;
  **Large** (`large`) and **X-Large** (`xlarge`) make them bigger, and Natural tiles can also be **Small** (`small`).
  Square tiles get bigger by using fewer columns (see [Square](#square)); Natural rows by starting 100px bigger or
  smaller at each step (see [Natural](#natural)). Square tiles left at Small show at Medium.
- **Show info** puts each photo's title, place, color bar and comment under its tile (`?info=true`).

**Reset to defaults** goes back to Medium with info hidden. Both are remembered with the Grid's other settings.

**Recently Added** (`?sort=added`) puts the photos most recently added to the portfolio first, by their
[`addedDate`](data-model.md#date-added). Photos added on the same day go by when they were taken, newest first,
and photos that have no date added yet come after the rest, newest first.

**Time of Day** (`?sort=time`) puts the photos in the order of the time of day they were taken, from just after
midnight to just before, whatever the day, so sunrises gather at the start and night shots at the end. The time is
the clock where the photo was taken (its custom date, or else its EXIF date, which has no time zone), not the
viewer's. Photos taken in the same minute go newest first.

> **Frontend analogy:** like sorting `Date`s by `getHours() * 60 + getMinutes()` instead of `getTime()`: the date
> part is dropped, so a 7 AM photo from 2019 sits next to a 7 AM photo from last week.

## Square

Each photo as the square picked on the pipeline's Photo page, in a grid whose columns grow as the window widens:

| Size             | Phone | `sm` (640px) | `lg` (1024px) | `xl` (1280px) | `2xl` (1536px) |
| ---------------- | ----- | ------------ | ------------- | ------------- | -------------- |
| Medium (default) | 2     | 3            | 4             | 5             | 6              |
| Large            | 1     | 2            | 3             | 4             | 5              |
| X-Large          | 1     | 2            | 2             | 3             | 4              |

The square is a 500px image, so at the bigger sizes it can look a little soft on high-density screens.

## Natural

Each photo at its own aspect ratio (`?view=natural`), in justified rows (`components/natural-grid.tsx`,
`lib/natural-rows.ts`): a row's tiles are all the same height, and a full row's tiles grow together to fill its width.
Vertical photos (narrower than 0.9 of their height) are gathered into rows of their own, which start tall enough for
each photo to be at least 400px wide (rows of wide photos start 250px tall), so they show larger instead of being squeezed between wide photos. Each row starts with the next photo in
the sort and takes the next photos of the same kind until another wouldn't fit, so photos stay close to their place in
the sort, moved at most a row or so. When too few photos of one kind are left to fill a row, the rest share rows of the
wide height. The last row isn't stretched.

Those starting sizes are for **Medium**. Each **Size** step moves both by 100px:

| Size             | Rows of wide photos start | Vertical photos start |
| ---------------- | ------------------------- | --------------------- |
| Small            | 150px tall                | 300px wide            |
| Medium (default) | 250px tall                | 400px wide            |
| Large            | 350px tall                | 500px wide            |
| X-Large          | 450px tall                | 600px wide            |

Since a full row's tiles grow to fill it, a bigger size means fewer photos per row rather than exactly that height:
at X-Large on a laptop, a row of wide photos often holds just one. No tile grows taller than 90% of the window (`90vh`); a row whose tiles
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
