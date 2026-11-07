# Trip Lines

`/trip-lines`, under **Configuration** in the sidebar, marks the route of a day: a solid line walking from photo to
photo in the order they were taken, and a dashed hop by train, subway, bus or car between two of them. Commit bakes
every day's line, with its photos' spots filled in, into one file the portfolio's map can draw as it is.

> **Frontend analogy:** the day files are the source, like `.tsx`, and `TRIPLINES.geo.json` is the build output, like
> the bundle. Commit is the build step, so the browser never works routes out; it only loads the result.

## The file

Each day with a line is one file, `triplines/<YYYY-MM-DD>.json`, and **Commit** combines them into
`triplines/TRIPLINES.json` the way it combines the timeline labels into `TIMELINE.json`:

```json
{
  "id": "2026-10-01",
  "day": "2026-10-01",
  "auto": false,
  "segments": [
    {
      "mode": "walk",
      "start": { "latitude": 34.6655, "longitude": 135.5006, "label": "Hotel" },
      "photos": [302, 303, 304]
    },
    { "mode": "subway", "photos": [304, 305] },
    { "mode": "walk", "photos": [305, 306, 307] }
  ]
}
```

- **`segments`** are the stretches of the day, in the order they happened. Each one's line runs from `start` (when
  set), through its `photos` (photo IDs) in order, to `end` (when set).
- **`mode`** is `walk`, `train`, `subway`, `bus`, `car` (taxis too) or `transit`, a hop whose kind isn't known, as the
  automatic line marks one. A walk is drawn through every photo; the others are a straight dashed line from the first
  point to the last, since the real track isn't known.
- One photo can end a segment and start the next (304 and 305 above), so the line doesn't break at a station.
- **`start`** and **`end`** are spots with no photo, such as the hotel, with an optional `label`.
- **`auto: true`** with no segments turns on the [automatic line](#the-automatic-line).

A photo in a line must be from that day (its [custom date](data-model.md#date-taken), or else its EXIF date) and have
an exact spot: its custom GPS position, its EXIF one, or a [place](places-and-localizations.md) marked as an **Exact
location**. Saving (`PUT /api/triplines/<day>` → `PUT /triplines/{day}`) fails otherwise, and so does a segment with
fewer than two points. Saving and **Remove route** (`DELETE /api/triplines/<day>` → `DELETE /triplines/{day}`) keep the
file as a [change waiting for Commit](pending-changes.md), counted by the sync button as a trip line.

## The baked map: `TRIPLINES.geo.json`

Every Commit also writes `triplines/TRIPLINES.geo.json`, a GeoJSON `FeatureCollection` with one `LineString` per
segment, coordinates filled in from the photos:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [135.5006, 34.6655],
      [135.5012, 34.6663]
    ]
  },
  "properties": {
    "day": "2026-10-01",
    "mode": "walk",
    "auto": false,
    "photos": [302],
    "km": 0.1,
    "start": "Hotel"
  }
}
```

It's rebuilt from the day files and the photo files at each Commit, so fixing a photo's GPS position or date fixes its
line on the next one. Only photos on the portfolio are drawn (not drafts or [unselected
photos](compare-groups.md#unselected-photos)); a segment left with fewer than two points is skipped. Commit's counts say
how many lines it has (`tripLineSegments`).

## The automatic line

The automatic line is one walk through the day's photos in the order they were taken, broken where two photos are
more than 2 hours apart, with a `transit` hop where moving between two (more than 300 m apart) was faster than 6 km/h
(`autoSegments` in `be-pipeline/internal/github/triplines_auto.go`). `GET /api/triplines/<day>/auto` answers it for the
day as the next Commit would draw it.

A file with `"auto": true` keeps it on: it's worked out again at every Commit, so a photo added to that day later joins
the line.

## The page

The left side lists the days with two or more photos at two or more different exact spots, newest first, each with how
many photos and spots it has and whether its line is **Marked**, **Automatic** or **None**, with a filter by each.

The right side edits the chosen day: its photos in the order they were taken, with what happened between each two, and
a map of the line drawn through them (photos as numbered dots; walks solid, hops dashed). Pointing at a photo
highlights its dot.

- A day with no line offers **Preview automatic line**, drawn fainter and not saved, and **Mark by hand**, which starts
  from one walk through every photo. From the preview, **Turn on automatic line** saves `{ "auto": true }`, and **Edit as
  my own** copies it into the photo strip to change by hand.
- By hand, each gap between two photos is a menu: **Keep walking**, **Break** (the line stops, and starts again at the
  next photo), or a hop. A pin marks each photo a line starts at and a flag each one it ends at. **Starts from** and
  **Ends at** set a spot with no photo by clicking the map, with a label such as "Hotel". **Save route** saves it.
- An automatic day shows the line as the next Commit would draw it, with **Edit as my own** and **Turn off automatic
  line**.

The page reads the day files from the [combined data store](combined-data-store.md)'s `TRIPLINES.json` with the
changes since made over it, so a saved line shows at once.

The portfolio doesn't draw the lines yet; that's the next step.
