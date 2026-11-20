# The baked map: `TRIPLINES.geo.json`

Every Commit also writes `triplines/TRIPLINES.geo.json`, a GeoJSON `FeatureCollection` with one `LineString` per segment, coordinates filled in from the photos:

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

A hop with a `board` or `alight` station also gets a walk feature from its first photo to where it got on, and from where it got off to its last photo, along its `boardWalk` or `alightWalk` when it has one.

Each feature also has its segment's `name`, so the portfolio can show one group's line at a time.

Each feature also has `line`, `ref` and `colour` when its hop rode a picked line, so the portfolio can draw it in the line's color and name it.

A segment with a `path` is drawn along it, as long as the path still starts and ends within 300 m of the segment's first and last points; otherwise (say a photo's GPS position was fixed since) it falls back to straight lines through its points until it's snapped again.

It's rebuilt from the day files and the photo files at each Commit, so fixing a photo's GPS position or date fixes its line on the next one. Only photos on the portfolio are drawn (not drafts or [unselected photos](../compare-groups.md#unselected-photos)); a segment left with fewer than two points is skipped. Commit's counts say how many lines it has (`tripLineSegments`).
