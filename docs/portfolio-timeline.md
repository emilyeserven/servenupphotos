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

| Chart           | Shows                                                                                      | URL              |
| --------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| Graph (default) | Photos per day or per month across the selected range, as bars                             | left out         |
| Heatmap         | Photos per day for every year, like GitHub's contribution graph, with the range's days lit | `?chart=heatmap` |

On either chart, click a bar or day to select it, or click and drag across several to select the span between them. The
graph zooms into the range it selects. The heatmap always shows every year from the oldest photo to today, newest year
first, and fades the days outside the selected range. A day's square is darker the more photos were taken that day, in
four steps up to the busiest day, and a run of years without photos is folded into one line. Both charts count only the
photos the filters let through.
