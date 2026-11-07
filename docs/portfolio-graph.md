# Portfolio Graph

The portfolio's Graph page (`/graph`, `apps/portfolio/src/routes/graph.tsx`) draws a graph of your own from the counts
on the [Numbers](portfolio-stats.md) page. It's in the site menu after Numbers, with the other small views.

The builder's parts are in `components/graph-builder/`; what it counts is in `lib/graph-data.ts`, the camera
settings it adds in `lib/graph-settings.ts`, and the presets' row in `lib/graph-presets.ts`.

## Layout

**Presets** come first, then an **Adjust Graph** button, then the graph's box. Adjust Graph opens a box over the graph
with its settings and filters (closed when the page opens). The graph's box says how many photos the filters leave, has
the **Graph** / **Table** buttons, and names each axis: the y axis over the top left and the x axis centered under the
graph (a pie names its slices and size over it). Each axis name is a dropdown, so clicking it changes what's on that
axis without opening Adjust Graph.

## What you can pick

| Setting  | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type     | The **Graph type** button, like the Grid's **Gear & settings**: it opens a list of **Type** (**Bar**, **Line**, **Dot**, a dot for each value with no line, **Pie**, **Scatter** or **Heatmap**), **Split by** and **Parts** on the left, each saying what it's set to, and the chosen one's choices on the right. The button shows the type's icon and says what splits it, such as Bar, split by Season                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| X axis   | Any group on the Numbers page (Cameras, each lens category, Focal length, Lenses, Countries, Cities, Year, Season, Month, Time of day, Day of the week), or a camera setting under **Technical** (Aperture, Exposure, ISO, Focal length in mm). For a pie it's **Slices**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Y axis   | **Photos**, or **Share of photos (%)**. For a scatterplot or heatmap it's a second stat instead. For a pie it's **Size**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Split by | In the Graph type picker, for bar, line and dot graphs only: another stat that splits each value, such as each year's bar into seasons. Bars can be **Stacked** or **Side by side**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Order    | **As on Numbers** (the card's own order, such as newest year first), **Reversed**, or **Most photos first**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Show     | **All** of the x axis's values, or the first 5, 10 or 20 in that order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Range    | One group under the settings. **X axis**: the first and last value shown, picked from the values the axis has in its order, such as f/2 – f/8 (**Start** and **End** are the axis's own). **Y axis**: a bar, line or dot graph's y axis start and end, picked from round numbers up to its highest value (or 100% for shares); for a scatterplot or heatmap, its y stat's first and last value, like the x axis. **Photos per value**: **At least** one of the photo counts the x values have, leaving out x values with fewer. **Trim empty ends** leaves out the x values with no photos at either end of the axis; empty ones in between stay, so the scale keeps its steps. The camera settings always list every value any photo has, with 0 for the ones the filters leave out, so the axis keeps its whole scale. The choices are read from the photos the filters keep, and the range cuts the values before **Show** counts them |
| Filters  | The site's usual **Show filters** bar above the presets, with the text search, Places, Groups, When, Gear & settings and Orientation, kept in the URL like on the Grid, so the menu carries them between views                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The page opens on photos per year, oldest first, each bar split by season. Only the filters are kept in the URL.

**Wide**, beside Graph / Table, lets the page use the window's whole width instead of the usual column (**Narrow** puts
it back). The choice is remembered in the browser.

**Presets** are made on the pipeline's [Graph Presets](graph-presets.md) page and read from `graphs/GRAPHS.json`. Each
is a button that sets the graph's type, axes, split, order and how many values show; the filters stay as they are. A
**preset group** is a dropdown among the buttons, such as **When**, listing its presets; a group with no presets isn't
shown, and the row is left out when there are no presets at all. The committed ones are dot graphs of **Aperture**,
**Exposure**, **ISO** and **Focal length**: a dot for each value the photos were taken at, lowest first, at how many
photos have it. Presets can set the Range group too; one that leaves it out turns it off.

**Save as preset** asks for a name and keeps the graph's settings (not its filters) as one of the visitor's own presets,
shown after the site's with a bookmark and a × to remove it. They're kept in the browser's local storage
(`servenup:graph-presets`, `lib/saved-graphs.ts`), so they're only on that browser; in a private window they last
until the page is left.

> **Frontend analogy:** the site's presets are the app's built-in defaults shipped in the bundle (`GRAPHS.json`), and a
> visitor's own are user settings in `localStorage`, merged into one list when rendering.

**Save as preset** asks for a name and keeps the graph's settings (not its filters) as one of the visitor's own presets,
shown after the site's with a bookmark and a × to remove it. They're kept in the browser's local storage
(`servenup:graph-presets`, `lib/saved-graphs.ts`), so they're only on that browser; in a private window they last
until the page is left.

> **Frontend analogy:** the site's presets are the app's built-in defaults shipped in the bundle (`GRAPHS.json`), and a
> visitor's own are user settings in `localStorage`, merged into one list when rendering.

## How it's counted

Each stat is one of the Numbers page's groups (`STAT_SECTIONS` in `lib/stats.ts`), so a group added there shows up in
the dropdowns on its own. The camera settings count each value the photos have, as the Grid's range sliders list them.

- **Split**, **scatter** and **heatmap**: for each x value, the photos in it (found with the row's Grid filter, the same
  `filterWithCamera` the Grid uses) are counted again by the other stat. A split with more than 8 values shows the first
  7 in their own colors and the rest together as **Other**. With **Share of photos**, a split value is its share of
  that x value's photos, so stacked bars reach 100%.
- **Pie**: past 8 slices, the rest go together as **Other**.
- A photo can be in more than one row of a lens or camera category, so those parts can add up to more than the photos.

A scatterplot puts both stats' values on a grid, with a dot where they meet as big as how many photos have both, such as
Japan in Autumn. A heatmap counts the same pairs as a grid of cells, the x values across and the y values down,
each cell as dark as how many photos have both (from `--series-1` mixed into the card's color), with its count in it,
such as month by year or aperture by focal length. Empty cells stay gray, so the grid keeps every pair. A key over it
shows what the lightest and darkest shades mean, and it scrolls sideways when the x values don't fit. Every graph has a tooltip on hover, a key over it when it's split or a pie, and a **Table** button that
shows its numbers as a table.

The series colors are `--series-1` to `--series-8` in `styles.css`, with their own steps for dark mode, picked so
neighbors stay apart for colorblind eyes; a few light ones are faint on white, which is what the table view is for.

> **Frontend analogy:** the graph is a pivot table over the photo array. The x axis is the `groupBy`, the split is a
> second `groupBy` inside each group, and filters are a `.filter()` before both. Recharts only draws the result.
