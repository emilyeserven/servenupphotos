# The file

Each day with a line is one file, `triplines/<YYYY-MM-DD>.json`, and **Commit** combines them into `triplines/TRIPLINES.json` the way it combines the [Trips](../trips.md) into `TIMELINE.json`:

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

- **`name`** on a segment names the group of photos it's in, such as "Nara Park": each [group](groups.md) is a line of its own. A walk or hop from one group to the next has none.
- **`visits`** are the [trip stops](trip-stops.md) along the day's route, such as restaurants.
- **`fences`** are the [areas](areas.md) photos without an exact spot were taken in, such as a park.
- **`segments`** are the stretches of the day, in the order they happened. Each one's line runs from `start` (when set), through its `photos` (photo IDs) in order, to `end` (when set). `from` and `to`, when set, are drawn instead of the first and last photo: the exit and entrance of an [area wandered](groups.md#areas-wandered).
- **`order`** is the day's photo IDs in the order they were [moved into by hand](groups.md), such as when a camera's clock was off; left out while they're in the order taken.
- **`mode`** is `walk`, `train`, `subway`, `bus`, `car` (taxis too), `transit` (a hop whose kind isn't known, as the automatic line marks one) or `wander` (an [area wandered](groups.md#areas-wandered) with no set route, drawn with no line). A walk is drawn through every photo; the others are a straight dashed line from the first point to the last, since the real track isn't known.
- One photo can end a segment and start the next (304 and 305 above), so the line doesn't break at a station.
- **`start`** and **`end`** are spots with no photo, such as the hotel, with an optional `label`.
- **`via`** lists spots with no photo the line bends through, each with the photo it comes `after` (none for right after `start`), `visit` when it stands for a [trip stop](trip-stops.md) on the route, and on a walk `by`: `road` or `foot` for how the walk goes to and from it when snapped (left out, the snap chooses). See [Shaping the line](shaping-the-line.md).
- **`path`** is a walk, bus or car segment's line along the streets, as `[longitude, latitude]` pairs, from **Snap to streets**, or a hop's track along its `line`. A train, subway or transit hop keeps one only with a line.
- **`line`** is the bus, subway or train line a hop rode, picked under [Lines ridden](lines-ridden.md): `{ "id": 1234, "name": "Midosuji Line", "ref": "M", "colour": "#e5171f" }`, where `id` is the OpenStreetMap route relation. Only train, subway, bus and transit hops keep one.
- **`like`** is `car` or `bus` on a `transit` hop drawn like that mode ([Drawing a transit hop like a car or bus](lines-ridden.md#drawing-a-transit-hop-like-a-car-or-bus)): it's snapped to streets by road, keeps its `path`, and is baked as that mode. Left out on any other hop, and it does nothing while the hop rides a line found in a source.
- **`board`** and **`alight`** are the station or stop a hop with a `line` got on and off at, with its name as the `label`, when that isn't at the photo: say the subway was left and then a 10-minute walk led to the next photo.
- **`boardWalk`** and **`alightWalk`** shape the walk from the hop's first photo to `board`, and from `alight` to its last photo: `{ "via": [{ "latitude": …, "longitude": … }], "path": [[lng, lat], …] }`, both optional. Without them (or with a `path` that no longer fits) the walk is straight through its via spots.
- **`auto: true`** turns on the [automatic line](automatic-line.md); its segments are filled in by the backend.

A photo in a line must be from that day (its [custom date](../data-model.md#date-taken), or else its EXIF date) and have an exact spot: its custom GPS position, its EXIF one, or a [place](../places-and-localizations.md) marked as an **Exact location**. Saving (`PUT /api/triplines/<day>` → `PUT /triplines/{day}`) fails otherwise, and so does a segment with fewer than two points. Saving and **Remove route** (`DELETE /api/triplines/<day>` → `DELETE /triplines/{day}`) keep the file as a [change waiting for Commit](../pending-changes.md), counted by the sync button as a trip line.
