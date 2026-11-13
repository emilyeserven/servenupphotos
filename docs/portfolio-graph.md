# Portfolio Graph

The portfolio's Graph page (`/graph`, `apps/portfolio/src/routes/graph.tsx`) draws a graph of your own from the counts
on the [Numbers](portfolio-stats.md) page. It's in the site menu after Numbers, with the other small views.

The builder's parts are in `components/graph-builder/`; what it counts is in `lib/graph-data.ts`, the camera
settings it adds in `lib/graph-settings.ts`, and the presets' row in `lib/graph-presets.ts`.

## Layout

The pipeline's **spotlight** presets come first, each its own button with a star, then a row of tabs
(`graph-tabs.tsx`): **Presets**, **Adjust Graph** and **Filters** on the left and **Save as preset** on the right. Each
tab opens its own box under the row, and clicking the open tab closes it; all are closed when the page opens. Adjust
Graph's box holds the graph's settings, and Filters' box the site's usual filters, with the Filters tab counting how
many are set. The graph's box says how many photos the filters leave, has
the **Graph** / **Table** buttons, and names each axis: the y axis over the top left and the x axis centered under the
graph (a pie names its slices and size over it). Each axis name is a dropdown, so clicking it changes what's on that
axis without opening Adjust Graph.

## What you can pick

Adjust Graph's box has three buttons, data first: **Axes**, **Graph type** and **Range**, each opening a picker like the
Grid's **Gear & settings** (`graph-picker.tsx`): its sections on the left, each saying what it's set to, and the chosen
one's choices on the right.

| Button     | Sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axes       | **X axis** (a pie's **Slices**): Any group on the Numbers page (Cameras, each lens category, Focal length, Lenses, Countries, Cities, Year, Season, Month, Time of day, Day of the week; the Exposure Triangle's Aperture and ISO groups are listed as **Aperture ranges** and **ISO ranges**), a camera setting under **Technical** (Aperture, Exposure, ISO, Focal length in mm), which has a row for every value, or five stats only the Graph has (**Genre** and **Tags** under **Subject**; **Main color**, **Lightness** and **Orientation** under **Look**). Every stat has its own ID: a Numbers group with a camera setting's ID gets `-ranges` added (`aperture-ranges`, `iso-ranges`), so `aperture` and `iso` in presets and links always mean every value (`lib/graph-stat-ids.ts`). For a pie it's **Slices**. **Y axis** (a pie's **Size**; none for photo dots, whose stacks are always photos): **Photos** or **Share of photos (%)**, or for a scatterplot or heatmap a second stat. **Order**: **X axis, asc**, **X axis, desc** or **Most photos first** (`lib/graph-order.ts`; a stat whose own order runs high to low, such as Year's newest first, has asc and desc swapped so asc is always low to high)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Graph type | **Type**: **Bar**, **Line**, **Pie**, **Scatter**, **Heatmap** or **Photo dots** (one dot for every photo), each with its icon; the button shows the chosen type's icon. The (i) beside the list's intro opens an info pane (`graph-type-info.tsx`) with a little diagram of the type pointed at, or else the chosen one, under a **Best for** heading the data it suits best, and under **For these axes** how it suits what's on the axes and why. The type that suits the axes best is marked **Suggested**, and poor fits are dimmed but can still be picked (see [Suggested type](#suggested-type)). **Split by** (bar, line and photo dot graphs only): another stat that splits each value, such as each year's bar into seasons. **Parts** (a split bar): **Stacked** or **Side by side**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Range      | **X axis**: the first and last value shown, picked from the values the axis has in its order, such as f/2 – f/8 (**Start** and **End** are the axis's own). **Y axis** (not for a pie or photo dots): a bar or line graph's start and end, picked from round numbers up to its highest value (or 100% for shares); for a scatterplot or heatmap, its y stat's first and last value. **Photos per value**: **Any**, or **At least** one of the photo counts the x values have. **Show**: **All** of the x axis's values, or the first 5, 10 or 20 in its order. **Empty ends**: **Keep them**, or **Trim them**, leaving out the x values with no photos at either end of the axis (empty ones in between stay, so the scale keeps its steps). **X axis buckets**: **Each value**, or **Every 2, 3, 4, 5 or 10 values** put together in the axis's own order, each named from its first to its last value, such as f/1.4 – f/2, with all their photos (`lib/graph-buckets.ts`); only sizes under how many values the axis has are offered, and changing one resets the axis's ends. A camera setting also offers **Even ranges**, each the same width on the setting's own scale (`lib/even-buckets.ts`): aperture in 1 or 2 stops (f/2 – f/2.8, f/2.8 – f/4 …), exposure in 1, 2 or 3 stops, ISO in 1 or 2 stops, and focal length in 10, 25, 50 or 100 mm. Each range runs from its start up to the next one's, and empty ranges between stay so the scale is even; picking an even width turns off the every-N choice, and the other way round. **Y axis buckets** does the same for a scatterplot or heatmap. The camera settings always list every value any photo has, with 0 for the ones the filters leave out, so the axis keeps its whole scale. The choices are read from the photos the filters keep, and the range cuts the values before **Show** counts them |

### Suggested type

The Graph type picker reads what's on the axes and rates each type `best`, `good` or `poor`, with one sentence saying
why (`lib/graph-suggest.ts`). It goes by each stat's kind and how many values the x axis shows among the photos the
filters keep:

- **Time**: Year, Season, Month, Time of day and Day of the week.
- **Number scale**: the camera settings (Aperture, Exposure, ISO, Focal length in mm), the Numbers page's Aperture,
  Shutter speed, ISO and Focal length (and their `aperture-ranges` and `iso-ranges` IDs), and Lightness, whose five
  bands run from Very dark to Very light.
- **Category**: everything else, such as Main color and Orientation, so a stat added to the Numbers page later counts
  as one.

| X axis                               | Best       | Good                | Poor                                                                   |
| ------------------------------------ | ---------- | ------------------- | ---------------------------------------------------------------------- |
| Year                                 | Line       | Bar, Photo dots     | Pie ("slices lose the order")                                          |
| Another time                         | Bar        | Line, Photo dots    | Pie                                                                    |
| Number scale                         | Photo dots | Bar, Line           | Pie                                                                    |
| Category, 8 or fewer                 | Bar        | Pie, Photo dots     | Line ("a line suggests an order these don't have")                     |
| Category, more than 8                | Bar        | Photo dots          | Pie ("past 8 slices the rest go into Other"), Line                     |
| Camera or lens category, genre, tags | as above   | as above, minus Pie | Pie ("a photo can be in more than one slice, so the shares pass 100%") |

**Scatter** and **Heatmap** compare two stats, so they're good for any x axis. While the graph is one of them, the y
axis's stat counts too: with both axes a time or number scale, Heatmap is best and Scatter good, and with a category on
either, both are good; the one-stat types are then at most good, since they'd leave the y axis's stat out. The best
type, if there is one, is the suggestion; when two tie, the first in the list wins.

When the visitor changes an axis and the type becomes a poor fit, a line over the graph says so, such as **A bar graph
suits Lenses better.**, with **Switch** to set that type and an X to hide it (`type-suggestion.tsx`). It goes away once
the type fits. The type never changes by itself, and the line doesn't show for the graph the page opened on, a link,
or a preset the visitor picked, until they change an axis.

> **Frontend analogy:** like a form's inline validation hint: derived from the current values on each render, never
> written back into them, and only shown once the visitor has touched the field.

The **Filters** tab's box holds the site's usual filters, with Places, Groups, When, Gear & settings and Orientation, kept in the URL like on the Grid, so the menu carries them between views. The Graph page has no text search.

The page opens on photos per year, oldest first, each bar split by season. The graph's settings are kept in the URL
beside the filters (`lib/graph-search.ts`), so a link shares the graph:

- Every graph, a built-in preset's too, is written as each setting that differs from the opening graph, with `g`
  before its name so it can't clash with a filter, such as `?gType=pie&gX=cameras`. A split of none is `gSplit=none`.
  Writing a preset's settings rather than its name keeps a link showing the same graph even if the preset changes,
  and lets a preset's link be tweaked by hand.
- Links from before this name a built-in preset by its ID, such as `?graph=aperture`, and still open it, with any
  settings beside it on top. Settings a link gets wrong, such as an unknown type, are ignored.

Changing the graph replaces the URL rather than adding to the browser's history. **Wide**, the Graph / Table view and
the display options stay out of the URL.

**Wide**, beside Graph / Table, lets the graph's box use the window's whole width instead of the usual column, while
the heading, buttons, Adjust Graph box and Selected Photos stay in the column (**Narrow** puts it back). The choice is remembered in the browser.

**Presets** are made on the pipeline's [Graph Presets](graph-presets.md) page and read from `graphs/GRAPHS.json`. The
**Presets** tab opens a `SectionPicker` like the Grid's **Groups** (`preset-picker.tsx`): the preset groups on the left, each
saying which of its presets the graph is set as, with the presets in no group as **Other** (or **Presets** when there
are no groups) and the visitor's own as **Yours**, and the chosen group's presets on the right. Picking one sets the
graph's type, axes, split, order, how many values show and its Range group; the filters stay as they are. The **(i)**
button over the presets opens the picker's info pane, further right (under the presets on phones), listing the settings of the preset pointed at, or the one the graph
is set as (`preset-settings.tsx`). A group with no presets isn't shown. The committed presets are photo dot graphs of
**Aperture**, **Exposure**, **ISO** and **Focal length**, plus Month by year and Time of day by weekday heatmaps.

Whenever the graph's settings match a preset, whether it was picked, set by hand in Adjust Graph, or opened from a
link, that preset is checked off in the picker and its group names it (`presetIsOn` in `lib/graph-presets.ts`). A
setting the preset's type doesn't draw, such as a photo dot graph's or bar graph's y axis stat, isn't compared, since a
link leaves it out.

A preset the pipeline marks **Spotlight** also shows as its own button above Presets and Adjust Graph, with a check
in place of its star and a filled background while the graph matches it.

The **Save as preset** tab lists the settings it will keep, then asks for a name; its **Save preset** button keeps the graph's settings (not its filters) as one of the visitor's own presets,
listed under **Yours** in the picker with a × to remove it. They're kept in the browser's local storage
(`servenup:graph-presets`, `lib/saved-graphs.ts`), so they're only on that browser; in a private window they last
until the page is left.

> **Frontend analogy:** the site's presets are the app's built-in defaults shipped in the bundle (`GRAPHS.json`), and a
> visitor's own are user settings in `localStorage`, merged into one list when rendering.

## Photos of a picked value

Clicking a bar, a line graph's point, a slice, a scatterplot dot or a heatmap cell with photos shows its photos in a **Selected Photos** box under the graph
(`components/graph-builder/picked-photos.tsx`, with what's picked worked out in `lib/graph-pick.ts`). Every other value
fades while one is picked (a dashed line marks it on a line graph, and a ring on a heatmap cell); clicking it again, **Close**, or changing the
graph in any way clears it. The photos are the ones the filters keep, and each opens in the lightbox.

The box's heading names each axis and what's on it for the pick: **X axis** with its stat and value (such as Year:
2016), **Y axis** with how many photos (or what share) it has, or a scatterplot dot's y stat and value, and **Grouped
by** when the photos are in groups. A pie says **Slices** and **Size** instead.

- On a split graph, such as each year's bar stacked by season, the photos are in a group for each split value with any,
  in its color. Each group opens and closes from its heading, with joined **Expand all** / **Collapse all** buttons (like
  Graph / Table) beside the order; all are open at first. Split values past the graph's own colors (drawn together as **Other**) get a group each, in gray.
- A pie's **Other** slice groups its photos by the x values it puts together.
- A scatterplot dot shows the photos that have both its values; a value that isn't split, its photos in one set.
- **Order by** (grouped photos only) orders the groups by their values on the axis (the Numbers card's order, or
  lowest first when they're all numbers, such as years) or by how many photos they have. **Ascending** and
  **Descending** turn that order around, and put each group's photos oldest or newest first by when they were taken.
- A group shows its first 48 photos, then **Show all**.
- Each group's count (or, when the photos aren't grouped, the count beside the order buttons) reads **See More (12)**
  on hover, as the Numbers page's rows do, and opens the group's photos on the Grid with the matching Grid filters: the page's own filters and search, the picked x value and the group's
  value, such as Year 2016 and Season Autumn (`lib/graph-pick-grid.ts`). When those filters wouldn't find exactly the
  group's photos, such as a value the Grid can't filter by, it opens them as photos chosen one by one (`ids`).

> **Frontend analogy:** the click is a row selection in a data table. The graph keeps the selected key in state and
> hands it down through context, and the box below runs the same `.filter()` the bar was counted from to list the rows.

## How it's counted

Each stat is one of the Numbers page's groups (`STAT_SECTIONS` in `lib/stats.ts`), so a group added there shows up in
the dropdowns on its own. The camera settings count each value the photos have, as the Grid's range sliders list them.

The five stats only the Graph has (`lib/graph-photo-stats.ts`, not on the Numbers page) are counted like this:

- **Genre** and **Tags**: a photo counts in each genre or tag it has, biggest first; a tag also counts the photos with a
  tag under it, as the tag filter does. Rows are named by the genre or tag.
- **Main color**: a photo's biggest color, such as Orange, or **Black & white** when nearly all of it is blacks, grays
  and whites (the Color page's 90% rule). Photos with no saved colors are counted as unknown.
- **Lightness**: five bands from **Very dark** to **Very light**, each a fifth of the 0 to 100 scale. Every band is kept,
  so an empty one shows 0.
- **Orientation**: **Horizontal**, **Vertical** or **Square**, leaving out any no photo is.

The site has no filter for Main color or Lightness, so those rows filter to their photos one by one (`ids`); a row with
no photos has no filter.

- **Split**, **scatter** and **heatmap**: for each x value, the photos in it (found with the row's Grid filter, the same
  `filterWithCamera` the Grid uses) are counted again by the other stat. A split with more than 8 values shows the first
  7 in their own colors and the rest together as **Other**. With **Share of photos**, a split value is its share of
  that x value's photos, so stacked bars reach 100%.
- **Pie**: past 8 slices, the rest go together as **Other**. Once its box is at least 560px wide, each slice is named around the pie with its value, such as Fujifilm X-T5 173 (`pie-parts.tsx`); **Display Options** beside **Wide** opens its display options, where **Pie → Slice names and values** turns that off (it's on at first, and narrower pies, such as on phones, leave the naming to the key). Its tooltip follows the cursor instead of sitting at the slice's middle.
- A photo can be in more than one row of a lens or camera category, so those parts can add up to more than the photos.

A scatterplot puts both stats' values on a grid, with a dot where they meet as big as how many photos have both, such as
Japan in Autumn. A heatmap counts the same pairs as a grid of cells, the x values across and the y values down,
each cell as dark as how many photos have both (from `--series-1` mixed into the card's color), with its count in it,
such as month by year or aperture by focal length. Empty cells stay gray, so the grid keeps every pair. A key over it
shows what the lightest and darkest shades mean, and it scrolls sideways when the x values don't fit.

**Photo dots** (`photos`) draws one dot for every photo, stacked over its x value with the stack's count on top, so it
reads like a bar graph you can count. Split by colors each dot by the photo's split value (the first one it has, in the
split's order; past 8 values, Other's gray), with the photos in the same colors grouped together. The stacks get wider
as the biggest one grows, so the tallest stays at most 30 dots high. Hovering a dot names its photo and the day it was
taken, and clicking a stack picks its x value like a bar. Its key always shows, saying a dot is **One photo**, then
the split's colors when it's split. It has no y axis setting or y range, since a stack is always
its photos; its **Table** shows each x value's photo counts (`lib/graph-photo-dots.ts`,
`components/graph-builder/photo-dots-graph.tsx`).

Every graph has a tooltip on hover, a key when it's split, a pie or photo dots (`graph-key.tsx`): a **Key** button at the right end of the y axis's row over the graph (`KeyRow`), so folded it covers nothing and takes no room of its own, and open at first, its list floating over the graph's top right corner, apart from the y axis, and a **Table** button that
shows its numbers as a table.

The site's presets come in two groups: **Technical Details** (Aperture, Exposure, ISO and Focal length) and **Time
Heatmaps**: **Time of day by weekday** (days of the week across, times of day down) and **Month by year** (months across,
years down).

The series colors are `--series-1` to `--series-8` in `styles.css`, with their own steps for dark mode, picked so
neighbors stay apart for colorblind eyes; a few light ones are faint on white, which is what the table view is for.

> **Frontend analogy:** the graph is a pivot table over the photo array. The x axis is the `groupBy`, the split is a
> second `groupBy` inside each group, and filters are a `.filter()` before both. Recharts only draws the result.
