# Trip Lines

`/trip-lines`, under **Configuration** in the sidebar, marks the route of a day: a solid line walking from photo to photo in the order they were taken, and a dashed hop by train, subway, bus or car between two of them. Commit bakes every day's line, with its photos' spots filled in, into one file the portfolio's map can draw as it is.

> **Frontend analogy:** the day files are the source, like `.tsx`, and `TRIPLINES.geo.json` is the build output, like the bundle. Commit is the build step, so the browser never works routes out; it only loads the result.

## Parts

Each part of trip lines has its own file in [`trip-lines/`](trip-lines):

- [The file](trip-lines/the-file.md)
- [The baked map: `TRIPLINES.geo.json`](trip-lines/baked-map.md)
- [The automatic line](trip-lines/automatic-line.md)
- [The page](trip-lines/the-page.md)
- [Line styles](trip-lines/line-styles.md)
- [Trip Stops](trip-lines/trip-stops.md)
- [Areas](trip-lines/areas.md)
- [Groups](trip-lines/groups.md)
- [Shaping the line and snapping it to streets](trip-lines/shaping-the-line.md)
- [Lines ridden](trip-lines/lines-ridden.md)

## Trips

A day's line can't cross midnight, so the ferries and flights between days are the legs of a [Trip](trips.md), on the Trips tab. Commit bakes them into `TRIPLINES.geo.json` with the days' lines.

## Trip page story

The day's **Story** page, **Trip page story**, writes the words around the day's photos for the portfolio's Trip page: a caption on each photo, a paragraph between photos, and which photos share a row. See [Trip Pages](trip-pages.md).
