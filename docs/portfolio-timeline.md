# Portfolio Timeline

The portfolio's Timeline (`/timeline`) lists the photos in a time range, newest first, grouped by month and then by day.
The month and day headings stay at the top of the window while their photos scroll past, and clicking a month's heading
folds it away. A day covered by a [timeline label](timeline-labels.md), such as **Japan** for a trip, shows the label beside
the date in its heading, so the label of the days in view sits just under the month's heading. Clicking a photo's
thumbnail or title opens the photo viewer. The filters are described in
[Portfolio Filters](portfolio-filters.md), including the [text search](portfolio-filters.md#text-search) box.

When an album is picked for the **Timeline Header** zone on the pipeline's [Site Spotlight](publish.md#site-spotlight) page,
its photos fade in and out across the top of the page, up to 30% of the screen's height, fading into the background,
with the title and filters under them (see [Header spotlights](publish.md#header-spotlights)).

## Route sketches

A day with a [trip line](trip-lines.md) has a small sketch of its route at the right end of its heading
(`components/timeline-route-sketch.tsx`): the day's lines and places visited from the `TRIPLINES.geo.json` that Commit
bakes, fitted into 48 × 32 px with their shape kept, in the Map's line styles and colors (walks solid blue, drives in
long light blue dashes, rides in their line's color, other hops dashed purple, places visited as amber dots). Areas are left
out. Clicking it opens the [Map](portfolio-map.md) on that day, zoomed to fit the day's whole line
(`/map?day=2026-09-23&lat=…&lng=…&zoom=…`, worked out for the window's size in `lib/fit-view.ts`). The file loads after the page,
so the sketches appear a moment later, and on screens under 360 px wide they're hidden.

> **Frontend analogy:** the sketch is a sparkline for a route: the same GeoJSON the Map draws with MapLibre, drawn
> instead as one tiny inline `<svg>` with no tiles, like a chart thumbnail.

### Month trip line maps

A month with trip lines on any of its shown days has a **Trip lines** button at the right end of its heading that opens and
closes
small maps of them (`components/timeline-month-map.tsx`). They start closed; **Open trip line maps** under **Each month**
in Display Options (`?maps=true`) starts every month open instead, and changing it opens or closes them all. The maps are 144 × 96 px each, with every line of those days drawn together in the same
styles as the day sketches. The days are grouped by where their lines are (`lib/route-places.ts`): a day joins the first
group its lines come within about 50 km of, so a city and its day trips share one map while two cities on one trip each
get their own, rather than shrinking to two dots in one box. Each map is labelled with its days ("Jan 19" or "Oct 3–6")
and opens the [Map](portfolio-map.md) on that date range, zoomed to fit its lines. A Trip's legs between days, such as
flights, are left out as in the day sketches.

Lines that run over an earlier one are drawn to its side in both the day sketches and the month maps, in the lanes the
Map gives them (`lib/trip-lanes.ts`), moved 1.5 px (days) or 2.5 px (months) to the right of their direction of travel.

> **Frontend analogy:** grouping the days is like bucketing chart points before drawing small multiples: one sparkline
> per bucket reads better than one sparkline squashed to fit outliers.

## Scrubber

Once the header (title and filters) has scrolled up out of the window, a scrubber appears down the right edge, like the one in Google Photos.
It has a tick for each month in the list and a label for each year at its first month. With **Scrubber ticks** set to
**Day, month & year** in the display options, it has a tick for each day instead, labeled with each
month's short name at its first day and the year at a year's first day, and its bubble names the day. The tick at the
start of a bigger unit is bigger: a year's first month or day has the longest, darkest tick, and with day ticks a
month's first day has a longer one than the days after it. A label that would crowd another is left out, years last. Each tick sits as far down the scrubber as its month is down the list, so a busy month
takes up more of it. A line marks the month now at the top of the window. Pointing at the scrubber shows a bubble naming
the month there, with the [timeline label](timeline-labels.md) of the days there under it, and clicking or dragging along it scrolls the list to that month; on a phone, touch and drag. With the
scrubber focused, the up and down arrow keys move a month at a time. It measures the list again whenever it changes
size, such as when a month is folded away or the thumbnail size changes.

## Display options

**Display Options**, at the right end of the row with the search and **Show filters**, opens the display options in a
wide flyout: the thumbnail size and scrubber ticks in one column and the checkboxes for each photo and each month in another, stacked
on a phone. Each is kept in the URL, left out at its default, and
remembered in the browser with the rest of the Timeline's settings, so links to the Timeline from other pages open it the
same way.

| Option              | Choices                                                                           | URL                        |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| Thumbnail size      | Small (100px, the default), Medium (160px), Large (240px) or Huge (320px)         | `?thumbs=medium` and so on |
| Show technical info | Each photo's aperture, exposure, ISO, focal length, lens and camera; off          | `?tech=true`               |
| Show comments       | Each photo's comment, on one line; on                                             | `?comments=false`          |
| Show places         | Where each photo was taken; on                                                    | `?places=false`            |
| Scrubber ticks      | A tick for each month (Month & year, the default) or each day (Day, month & year) | `?ticks=days`              |
| Open trip line maps | Whether each month's [trip line maps](#month-trip-line-maps) start open; off      | `?maps=true`               |

On a phone, Large and Huge thumbnails sit above their photo's title instead of beside it.
**Reset to defaults** puts every option back.

## Time range

The days shown are the **When** filter's date range in [Filters](portfolio-filters.md) (`?start=…&end=…`); with no
date range the Timeline shows every photo, from the oldest to today. Seasons, months and the rest of the When filter
narrow it the same way they do on the other views. Clearing the filters goes back to every photo.

The Timeline used to have its own range picker, label picker and **Quick dates** menu. Links made with them still
open on the same photos (`lib/timeline-old-links.ts`), turned into filters as the page loads:

| Old link                           | Becomes                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `?from=2025-01-01&to=2025-03-31`   | `?start=2025-01-01&end=2025-03-31`                         |
| `?range=30d` (and 7d, 90d, 6m, 1y) | `?start=` that many days back; `?range=all` is every photo |
| `?label=japan-2026-09-22`          | the label's first and last days as `?start=…&end=…`        |
| `?when=month` or `?when=date`      | this month (`?month=november`), in every year              |
| `?when=season`                     | this season (`?season=autumn`), in every year              |

> **Frontend analogy:** like a redirect map for old routes, but for search params: `validateSearch` rewrites the old
> keys into the new ones, and the next navigation writes the new ones back to the URL.

The Timeline has no chart of its own: the [Graph](portfolio-graph.md) page charts photos over time, and the
[scrubber](#scrubber) shows how busy each month is by how much of it the month takes up. Old links with
`?chart=heatmap` open the Timeline without it.
