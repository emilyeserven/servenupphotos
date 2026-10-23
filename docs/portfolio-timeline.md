# Portfolio Timeline

The portfolio's Timeline (`/timeline`) lists the photos in a time range, newest first, grouped by month and then by day.
The month and day headings stay at the top of the window while their photos scroll past, and clicking a month's heading
folds it away. Clicking a photo's thumbnail or title opens the photo viewer. **Show Technical Info** (`?tech=true`)
adds each photo's aperture, exposure, ISO, focal length, lens and camera under its comment. The filters are described in
[Portfolio Filters](portfolio-filters.md).

## Time range

The range picker chooses a quick range, such as **Last 30 days** (`?range=30d`), or two dates (`?from=…&to=…`). **Reset**
goes back to **All time**. The chart under the header picks a range too, and the buttons above it switch between two
charts:

| Chart           | Shows                                                                                        | URL              |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------- |
| Graph (default) | Photos per day or per month across the selected range, as bars                               | left out         |
| Heatmap         | Photos per week for every year, like GitHub's contribution graph, with the range's weeks lit | `?chart=heatmap` |

On either chart, click a bar or week to select it, or click and drag across several to select the span between them. The
graph zooms into the range it selects. The heatmap always shows every year from the oldest photo to today, side by side
with the oldest on the left, and scrolls sideways through them, starting at the newest. Each year has a column per
month holding one square for each week that starts (on Sunday) in that month. A week's square is darker the more photos
were taken that week, in four steps up to the busiest week, weeks outside the selected range are faded, and a run of
years without photos is folded into one narrow note. On a phone, swiping scrolls the years, so tap a week to select it.
Both charts count only the photos the filters let through.
