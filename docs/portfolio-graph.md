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

| Setting  | What it does                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type     | A dropdown of **Bar**, **Line**, **Dot** (a dot for each value, no line), **Pie** or **Scatter**                                                                                                                                                                          |
| X axis   | Any group on the Numbers page (Cameras, each lens category, Focal length, Lenses, Countries, Cities, Year, Season, Month, Time of day, Day of the week), or a camera setting under **Technical** (Aperture, Exposure, ISO, Focal length in mm). For a pie it's **Slices** |
| Y axis   | **Photos**, or **Share of photos (%)**. For a scatterplot it's a second stat instead. For a pie it's **Size**                                                                                                                                                             |
| Split by | Bar, line and dot graphs only: another stat that splits each value, such as each year's bar into seasons. Bars can be **Stacked** or **Side by side**                                                                                                                     |
| Order    | **As on Numbers** (the card's own order, such as newest year first), **Reversed**, or **Most photos first**                                                                                                                                                               |
| Show     | **All** of the x axis's values, or the first 5, 10 or 20 in that order                                                                                                                                                                                                    |
| Filters  | **Add a filter** picks a stat and the values to keep, such as Countries: Japan. A photo is kept with any of a filter's values, and must pass every filter.                                                                                                                |

The page opens on photos per year, oldest first, each bar split by season. Nothing is kept in the URL.

**Presets** are made on the pipeline's [Graph Presets](graph-presets.md) page and read from `graphs/GRAPHS.json`. Each
is a button that sets the graph's type, axes, split, order and how many values show; the filters stay as they are. A
**preset group** is a dropdown among the buttons, such as **When**, listing its presets; a group with no presets isn't
shown, and the row is left out when there are no presets at all. The committed ones are dot graphs of **Aperture**,
**Exposure**, **ISO** and **Focal length**: a dot for each value the photos were taken at, lowest first, at how many
photos have it.

## How it's counted

Each stat is one of the Numbers page's groups (`STAT_SECTIONS` in `lib/stats.ts`), so a group added there shows up in
the dropdowns on its own. The camera settings count each value the photos have, as the Grid's range sliders list them.

- **Split** and **scatter**: for each x value, the photos in it (found with the row's Grid filter, the same
  `filterWithCamera` the Grid uses) are counted again by the other stat. A split with more than 8 values shows the first
  7 in their own colors and the rest together as **Other**. With **Share of photos**, a split value is its share of
  that x value's photos, so stacked bars reach 100%.
- **Pie**: past 8 slices, the rest go together as **Other**.
- A photo can be in more than one row of a lens or camera category, so those parts can add up to more than the photos.

A scatterplot puts both stats' values on a grid, with a dot where they meet as big as how many photos have both, such as
Japan in Autumn. Every graph has a tooltip on hover, a key over it when it's split or a pie, and a **Table** button that
shows its numbers as a table.

The series colors are `--series-1` to `--series-8` in `styles.css`, with their own steps for dark mode, picked so
neighbors stay apart for colorblind eyes; a few light ones are faint on white, which is what the table view is for.

> **Frontend analogy:** the graph is a pivot table over the photo array. The x axis is the `groupBy`, the split is a
> second `groupBy` inside each group, and filters are a `.filter()` before both. Recharts only draws the result.
