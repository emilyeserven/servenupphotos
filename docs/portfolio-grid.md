# Portfolio Grid

The portfolio's Grid (`/grid`, `routes/grid.tsx`) shows every photo with resized versions in R2, newest first, in one of
three views picked at the top right (`?view=`): **Square** tiles (the default), **Natural** tiles, or a **Table**. Its
**Show filters** panel has the filters in [Portfolio Filters](portfolio-filters.md), including the camera filters, and
a **Visuals** button for colors and orientation (see [Portfolio Color](portfolio-color.md#on-the-grid-page)); they apply to every view. Clicking a
photo opens the [photo viewer](photo-viewer.md).

When an album is picked for the **Grid Header** zone on the pipeline's [Site Spotlight](publish.md#site-spotlight) page,
its photos fade in and out across the top of the page, up to 30% of the screen's height, fading into the background,
with the title and filters under them (see [Header spotlights](publish.md#header-spotlights)).

The tile views have **Sort** and **Display Options** at the right end of the row with the search and **Show filters**
(the Table has neither).

**Sort** (`components/grid-sort-control.tsx`) says just "Sort" until a sort is picked from its menu, and the photos are
newest first. Once one is picked, the button shows an arrow for which way it runs and the sort's name; clicking the
name opens the menu again, and clicking the arrow turns the sort around. **Clear sort** at the bottom of the menu goes
back to plain "Sort".

| Sort        | Default way                          | Turned around                  | URL                             |
| ----------- | ------------------------------------ | ------------------------------ | ------------------------------- |
| Date taken  | Newest first (↓)                     | Oldest first (↑)               | `?sort=newest`, `?sort=oldest`  |
| Date added  | Most recently added first (↓)        | Least recently added first (↑) | `?sort=added`, `&order=asc`     |
| Time of day | Earliest in the day first (↑)        | Latest in the day first (↓)    | `?sort=time`, `&order=desc`     |
| Distance    | Nearest first (↑)                    | Farthest first (↓)             | `?sort=distance`, `&order=desc` |
| Color       | Red around the color wheel first (↑) | The other way (↓)              | `?sort=color`, `&order=desc`    |
| Vividness   | Least vivid first (↑)                | Most vivid first (↓)           | `?sort=vivid`, `&order=desc`    |

With no `?sort=` the photos are newest first, the same as **Date taken** ↓, but the button says "Sort". The color
sorts' **Then by** sits beside **Sort** (see [Portfolio Color](portfolio-color.md#on-the-grid-page)).

**Display Options** (`components/grid-view-options.tsx`, using the flyout shared with the Map and Timeline,
`components/view-options-button.tsx`) has, side by side:

- **Size** (`?size=small|medium|large|xlarge`, `lib/grid-size.ts`): how big the tiles are. Square tiles come in
  Small, Medium (their default) and Large, by using more or fewer columns (see [Square](#square)). Natural tiles come
  in Small, Medium, Large (their default) and X-Large, by starting rows smaller or bigger (see [Natural](#natural)).
- **Show info** puts each photo's title, place, color bar and comment under its tile (`?info=true`).

The Table has a **Size** too, in its [View menu](#view-menu). The URL leaves `size` out when it's the view's own
default, and the one `size` is shared by the three views: switching views keeps it, showing X-Large as Large where a
view has no X-Large. **Reset to defaults** goes back to the view's default size with info hidden. Both are remembered
with the Grid's other settings.

**Recently Added** (`?sort=added`) puts the photos most recently added to the portfolio first, by their
[`addedDate`](data-model.md#date-added). Photos added on the same day go by when they were taken, newest first,
and photos that have no date added yet come after the rest, newest first. Turned around, the least recently added come
first, and photos with no date added still come last.

**Time of Day** (`?sort=time`) puts the photos in the order of the time of day they were taken, from just after
midnight to just before, whatever the day, so sunrises gather at the start and night shots at the end. The time is
the clock where the photo was taken (its custom date, or else its EXIF date, which has no time zone), not the
viewer's. Photos taken in the same minute go newest first. Turned around, night shots come first.

> **Frontend analogy:** like sorting `Date`s by `getHours() * 60 + getMinutes()` instead of `getTime()`: the date
> part is dropped, so a 7 AM photo from 2019 sits next to a 7 AM photo from last week.

**Distance** (`?sort=distance`, `lib/distance-sort.ts`) puts the photos nearest a spot first, measured along the
Earth's surface to where the [Map](portfolio-map.md) puts each photo: its custom or EXIF GPS position, or else the
position of one of its places, the same rule as the pipeline Gallery's **On the map** filter. Photos at the same
distance go newest first, and photos the map can't place come after the rest, newest first. Turned around, the
farthest come first, and photos the map can't place still come last.

While sorting by Distance, **From** sits beside **Sort** (`components/distance-from-control.tsx`) and says where it
measures from:

- **Stamford, CT**, the default, when the URL has no `?near=`.
- A country, region, city or place picked from the same columns as the Places filter, such as `&near=city:Stamford`.
  A place with its own GPS position set on the Places page measures from that; otherwise it measures from the middle
  of the photos taken there.
- **Use my location** (the crosshair beside **From**), which asks the browser where the viewer is, such as
  `&near=41.0534,-73.5387`. The browser asks the viewer's permission first; if it's refused or unavailable, the button
  turns red and its tooltip says so.

**×** goes back to Stamford, CT. Picking another sort clears `?near=`.

> **Frontend analogy:** like `photos.toSorted((a, b) => dist(here, a) - dist(here, b))`, where `dist` is the
> haversine formula, the distance between two latitude/longitude pairs on a sphere rather than a flat map.

## Square

Each photo as the square picked on the pipeline's Photo page, in a grid whose columns grow as the window widens:

| Size             | Phone | `sm` (640px) | `lg` (1024px) | `xl` (1280px) | `2xl` (1536px) |
| ---------------- | ----- | ------------ | ------------- | ------------- | -------------- |
| Small            | 3     | 4            | 5             | 6             | 8              |
| Medium (default) | 2     | 3            | 4             | 5             | 6              |
| Large            | 1     | 2            | 3             | 4             | 5              |

The square is a 500px image, so at Large it can look a little soft on high-density screens.

## Natural

Each photo at its own aspect ratio (`?view=natural`), in justified rows (`components/natural-grid.tsx`,
`lib/natural-rows.ts`): a row's tiles are all the same height, and a full row's tiles grow together to fill its width.
With **Keep the order** off (see [below](#keep-the-order); it's on by default), vertical photos (narrower than 0.9
of their height) are gathered into rows of their own, which start taller so each
vertical photo covers about the same area of the page as a 3:2 wide photo: a 2:3 photo's row starts 1.5 times as tall
as a row of wide photos (the row's height is the wide height times √(1.5 ÷ the photo's width over height)). Matching
area rather than width keeps a vertical photo from coming out several times bigger than the wide photos around it. Each row starts with the next photo in
the sort and takes the next photos of the same kind until another wouldn't fit, so photos stay close to their place in
the sort, moved at most a row or so. When too few photos of one kind are left to fill a row, the rest share rows of the
wide height. The last row isn't stretched. At Large, rows of wide photos start 250px tall.

Those starting sizes are for **Large**, the default. The other sizes move them:

| Size            | Rows of wide photos start | Rows of 2:3 vertical photos start |
| --------------- | ------------------------- | --------------------------------- |
| Small           | 100px tall                | 150px tall                        |
| Medium          | 150px tall                | 225px tall                        |
| Large (default) | 250px tall                | 375px tall                        |
| X-Large         | 350px tall                | 525px tall                        |

Since a full row's tiles grow to fill it, a bigger size means fewer photos per row rather than exactly that height:
at X-Large on a laptop, a row of wide photos often holds two. No tile grows taller than 90% of the window (`90vh`); a row whose tiles
all reach that is centered rather than stretched.

> **Frontend analogy:** like a CSS `flex-wrap` gallery, but the line breaks are worked out in JavaScript from the
> measured width (a `ResizeObserver`), so each line can hold only one kind of photo and have its own height.

### Keep the order

Gathering vertical photos into rows of their own moves photos a little out of the sort, so the Natural view keeps
the order by default: **Keep the order**, under **Rows** in its **Display Options**, starts on, and unticking it
(`?ordered=false`, remembered with the Grid's other settings) goes back to the rows described above. With it on, the
Natural view lays the photos out strictly in the sort (`lib/ordered-rows.ts`): read left to right and top to bottom, they come in
exactly the sort's order, and the photo viewer steps through them in the order they show. Wide and vertical photos
share rows. Each row aims for a quarter over the average of the heights its photos would start at above (about how much
the rows above grow to fill the width, so photos come out about as big at each **Size**; a row with vertical photos
aims taller, keeping them about as big as wide ones), and fills the width exactly. Where the rows break is
worked out for all of them at once, picking the breaks that keep every row closest to its aim (half as tall counts as
far off as twice as tall), so one awkward photo doesn't leave a squashed or towering row. The last row keeps its aimed
height rather than stretching, and no row is taller than 90% of the window. **Reset to defaults** turns it back on.

> **Frontend analogy:** it's how a word processor justifies a paragraph (the Knuth–Plass line breaking TeX uses):
> instead of filling each line greedily and stretching whatever's left, it tries every place each line could break
> and keeps the set of breaks with the least total stretching, using dynamic programming so it stays fast.

## Table

The **Table** (`?view=table`, `components/photo-table.tsx`) lists every photo as a row, including photos without resized
versions in R2: its thumbnail, title, when it was taken, when it was added to the portfolio (**Added**, a dash until Update Data dates it), its place, camera, lens and camera settings. Clicking a column's
name sorts by it (`?column=…&dir=…`), the **Columns** menu hides columns (`?hide=…`), and the photo viewer moves through
the rows in the table's sort. The tiles' sort and **Show info** are hidden here. Older `/table` links go to this view,
keeping their sort (their `?sort=` becomes `?column=`), columns, filters and open photo (`routes/table.tsx`,
`lib/table-search.ts`).

Once the table's header row scrolls above the top of the window, a copy of it sticks there until the last row goes
by, so the column names and their sort buttons stay in sight (`components/sticky-table-header.tsx`). The table sits in a
box that scrolls sideways on narrow screens, and that box keeps CSS `position: sticky` on the table's own header from
working, so the copy is a separate row that matches the columns' widths and follows the box's sideways scroll. Screen
readers and the keyboard use the table's own header; the copy's buttons work with a click or a tap.

> **Frontend analogy:** `position: sticky` sticks to the nearest ancestor that scrolls, and `overflow-x: auto` makes
> the box scroll on both axes, so a sticky header inside it would only stick within that box, never to the window.

### View menu

**View** picks how big the thumbnails are, under **Size**: **Small** (40px, the default), **Medium** (80px) or
**Large** (128px), kept as `?size=medium` or `?size=large`.

It also picks how much of each photo's location the **Place** column shows, under **Place names**:

| Choice                  | Shows                                                                       | URL                    |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------- |
| Most specific (default) | The most specific of its places, such as "Geunjeongmun Gate"                | left out               |
| All place names         | Its places as a phrase, such as "Geunjeongmun Gate in Gyeongbokgung Palace" | `?placeDetail=places`  |
| Include city            | Its places and its city                                                     | `?placeDetail=city`    |
| Include state           | Its places, its city and its state                                          | `?placeDetail=state`   |
| Include country         | Its places, its city, its state and its country                             | `?placeDetail=country` |

A photo without places shows its city, state and country (whichever it has). The most specific place is the one inside the most others
(see [Places](places-and-localizations.md#places)). Names are written the way the **Script display** setting says, and
hovering a place shows its GPS position, and its state and country when the text leaves them out. The column sorts by the text it
shows, in English. The choice stays with the Grid: the menu's links to other views don't carry it.
