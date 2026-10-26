# Portfolio Timeline

The portfolio's Timeline (`/timeline`) lists the photos in a time range, newest first, grouped by month and then by day.
The month and day headings stay at the top of the window while their photos scroll past, and clicking a month's heading
folds it away. Clicking a photo's thumbnail or title opens the photo viewer. The filters are described in
[Portfolio Filters](portfolio-filters.md).

## Scrubber

Once the chart has scrolled up out of the window, a scrubber appears down the right edge, like the one in Google Photos.
It has a short tick for each month in the list and a label for each year at its first month, leaving out a year whose
label would crowd the one above. Each tick sits as far down the scrubber as its month is down the list, so a busy month
takes up more of it. A line marks the month now at the top of the window. Pointing at the scrubber shows a bubble naming
the month there, and clicking or dragging along it scrolls the list to that month; on a phone, touch and drag. With the
scrubber focused, the up and down arrow keys move a month at a time. It measures the list again whenever it changes
size, such as when a month is folded away or the thumbnail size changes.

## Display options

The eye button at the end of the header opens the display options. Each is kept in the URL, left out at its default, and
remembered in the browser with the rest of the Timeline's settings, so links to the Timeline from other pages open it the
same way.

| Option              | Choices                                                                   | URL                        |
| ------------------- | ------------------------------------------------------------------------- | -------------------------- |
| Thumbnail size      | Small (100px, the default), Medium (160px), Large (240px) or Huge (320px) | `?thumbs=medium` and so on |
| Show technical info | Each photo's aperture, exposure, ISO, focal length, lens and camera; off  | `?tech=true`               |
| Show comments       | Each photo's comment, on one line; on                                     | `?comments=false`          |
| Show places         | Where each photo was taken; on                                            | `?places=false`            |

On a phone, Large and Huge thumbnails sit above their photo's title instead of beside it.
**Reset to defaults** puts every option back.

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
