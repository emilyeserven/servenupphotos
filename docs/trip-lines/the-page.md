# The page

`/trip-lines` lists the days with two or more photos at two or more different exact spots, newest first, as cards. Each card has how many photos and spots the day has, whether its line is **Marked**, **Out of date**, **Automatic**, **Planned** or **None** (with a filter by each), and a small drawing of the line from its file, by hand or automatic: the line in the map's colors and the photos as white dots, drawn as SVG over the map's basemap so the card shows where the day was. A day with photos but no line yet still shows its photos' dots on the basemap, with the reason there's no line (such as **No line yet**) in the drawing's corner, so you can see where it was before drawing one. The basemap is a few of CARTO's raster tiles (light or dark, like the map) laid in a Web Mercator box around the line (`lib/preview-tiles.ts`) and loaded lazily, rather than a whole map per card, so a long list stays quick; it zooms in no closer than zoom 16, and the list ends with the maps' credit to OpenStreetMap and CARTO. CARTO's raster tiles need an API key (without one they carry an "API key required" watermark): set `CARTO_KEY` in the repo's `.env`, the same name the portfolio's deploy uses, and restart the backend. The page reads it from `GET /api/basemap` (`httpapi/basemap.go`); with none, the cards have no basemap.

> **Frontend analogy:** a web map is a grid of 256 px images per zoom level, like a sprite sheet cut into squares, each zoom doubling the grid each way. Placing the few squares under the line behind the SVG is an absolutely positioned background behind a chart. An automatic line saved before its segments were kept shows a note until it's saved again or the next Commit fills them in. **Out of date** (in red) is a line marked by hand that doesn't go through every photo of the day with an exact spot, such as photos added since, or goes through photos no longer on that day; the Dashboard's **Needs attention** lists them as urgent and links to this list filtered to them. A new photo opens with a break on both sides, ready to join the line.

A card opens the day's own pages, each a tab with its own link:

| Page       | Path                      | What it has                                             |
| ---------- | ------------------------- | ------------------------------------------------------- |
| Route      | `/trip-lines/<day>/route` | The line switch, the photo strip, the map and its tools |
| Trip Stops | `/trip-lines/<day>/stops` | The map and the [trip stops](trip-stops.md) list        |
| Story      | `/trip-lines/<day>/story` | The [Trip page story](../trip-lines.md#trip-page-story) |

`/trip-lines/<day>` opens Route, and so does an old `/trip-lines/<day>/order` link: the Photo order page it had is now Route's **Stack groups**, which lays the strip's groups out top to bottom with what happened between them in between. The pages share one editor that stays mounted while hidden, so a change made on Trip Stops shows on Route before it's saved. **Every day** goes back to the list.

## The save bar

Under the editor on Route and Trip Stops, the save bar stays at the bottom of the screen. It says whether the day has **Unsaved changes**, and its one button saves the day as the line switch shows it, as a change waiting for Commit: **Save route** for a line by hand, **Turn on automatic line** or **Update automatic line** for the automatic line, and **Remove route** (or **Save trip stops**, when there was no line) for **No line**. Beside it, a note says what saving does that the button doesn't, such as that it turns the automatic line off. Leaving the day with changes not saved, by **Every day**, the sidebar or closing the tab, asks first; moving between the day's own pages doesn't (`components/trip-lines/day-save.ts`, `lib/trip-line-view.ts`).

> **Frontend analogy:** it's a form's dirty state with a sticky submit bar, plus TanStack Router's `useBlocker` as the "you have unsaved changes" prompt.

> **Frontend analogy:** the editor's state lives above the tabs, like lifting `useState` into a layout so switching nested routes doesn't reset a form.

The pages keep what's chosen in their URL, so a link or a reload opens them the same way (`lib/trip-lines-search.ts`, read by each route's `validateSearch`):

| Param | Where | What it opens | Unless set |
| --- | --- | --- | --- |
| `tab` | The list | `trips` for the Trips tab | Days |
| `show` | The list | The day list's filter: `marked`, `out-of-date`, `automatic`, `none` | All |
| `trip` | The list | A Trip on the Trips tab, from an older link: opens [its page](../trips.md) | None |
| `group` | A day | The group shown alone on the map (the eye), by its name | None |
| `stack` | A day | `true` lays the photo strip's groups out top to bottom | In a row |

For example, `/trip-lines?show=out-of-date` or `/trip-lines/2026-09-29/route?group=Engyoji%20Temple`. Clicks replace the history entry rather than adding one, so Back leaves the page. A new Trip isn't in the URL until it's saved. A link from before days had pages, `/trip-lines?day=2026-09-29&group=…`, opens that day's Route page.

> **Frontend analogy:** this is TanStack Router's search params used as the page's state store instead of `useState`, like keeping a table's sort and filter in the query string.

The Route page edits the day: its photos in the order they were taken, with what happened between each two, and a map of the line drawn through them (photos as numbered dots; lines as in [Line styles](line-styles.md)). Pointing at a photo highlights its dot. Right-clicking the map copies that spot's coordinates (see [Copy coordinates](../portfolio-map.md#copy-coordinates)).

- The line switch above the strip picks the day's kind of line: **No line**, **Automatic** or **By hand**. Picking one changes nothing saved until the save bar saves it. **Automatic** on a day without it shows a preview, drawn fainter, and saving turns it on as `{ "auto": true }`. **By hand** starts from the line shown by hand last, or else the line saved by hand, or else the automatic line (so it copies the preview to change by hand), or else one walk through every photo.
- By hand, each gap between two photos is a menu: **Keep walking**, **Break** (the line stops, and starts again at the next photo), or a hop by train, subway, bus, car or taxi, ropeway or gondola, or transit of unknown kind. An arrow marks each photo a line starts at and a flag each one it ends at (not a pin, since every photo in the strip has an exact spot; ones without go in [areas](areas.md) instead).
- **Start**, before the first photo, and **End**, after the last, are always at the ends of the strip (`components/trip-lines/strip-ends.tsx`). Each names what's there: a spot with no photo, such as "Hotel", or the trip stop the route starts or ends at, with its kind under the chip, such as "End (Station)", and no chip of its own beside it (move it or take it off the route from **Trip Stops**); dashed with **Set** when there's nothing. Its menu picks a spot with no photo on the map (a note over the map says to click it, with **Cancel**), labels or removes it, or puts a trip stop there. Setting a spot on an automatic day, or one with no line, starts a line by hand from what's shown.
- An automatic day shows the line as the next Commit would draw it. Putting trip stops on the route, moving them or taking them off (in the strip or on Trip Stops) keeps the line automatic, with a note that they aren't saved yet; any other change, such as a gap or the photo order, starts a line by hand. **Update automatic line** saves the line again as the day's photos and stops draw it now, so photos added since show without waiting for Commit. A day with **No line** likewise keeps no line when only its trip stops change.
- Changing what kind of line a day has never loses its trip stops or areas. The line switch carries them over, and removing the route of a day with stops keeps them as a line with no segments, marked `"planned": true` like a [planned day](#planned-days), which opens with no line drawn and its stops still on the map. A day with no stops or areas is removed outright.

## Planned days

**Plan a day**, above the cards, picks a date before its photos are taken and opens its Trip Stops page, to add the [trip stops](trip-stops.md) ahead, such as the restaurants booked for a day in Kyoto. Any day can be opened that way: a day without two or more photos at two or more exact spots says it's a planned day. Its map starts on the whole world until the first stop is added (by coordinate, or on the map), and saved places near its stops can be added from then on. Saving keeps it as a line with no segments, marked `"planned": true`, listed as **Planned** with how many stops it has. Once its photos are added, the day opens as walking through them with the stops kept (not put on the route yet), the way a line marked by hand starts; saving it then drops `planned`. A planned line is never **Out of date**.

> **Frontend analogy:** a planned day is like a draft route created before its data loads: the page renders from the saved stops alone, and the photos hydrate it once they exist, rather than the page waiting for them.
