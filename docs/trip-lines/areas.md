# Areas

A line only goes through photos with an exact spot: their own GPS position, or a place marked as an exact location. A photo that only has a neighbourhood or a park as its place has no point to draw, so **Areas** (under **Places visited**, on a day that has such photos) puts it in the area it was taken in, and the map shades that area with a dashed edge.

Type a name, or a Wikidata ID such as `Q1490`, and press **Find an area**. The box starts with the place or city of the first photo not in an area yet. Picking a result adds the area holding every photo not in one yet. Click a photo under an area to put it in or take it out; a photo is in one area at most. Rename or remove an area from its row.

The backend asks OpenStreetMap's [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) for places with an outline (`polygon_geojson`), simplified to about 50 m (`polygon_threshold`) and kept to 5,000 points. A Wikidata ID is looked up through the item's [OpenStreetMap relation ID (P402)](https://www.wikidata.org/wiki/Property:P402); an item without one can't be used, so search by name instead. Requests go at most once a second and name the pipeline in their `User-Agent`, as the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks. `NOMINATIM_URL` and `WIKIDATA_URL` point it at other servers.

A search asks only when **Find an area** is pressed, never while typing. A name is one Nominatim request and a Wikidata ID is two (Wikidata, then Nominatim). The page keeps each answer until it's reloaded, and the backend keeps it for a day (up to 100 searches, `internal/memo`), so asking the same thing again sends nothing. Neither server needs a key or charges for requests; the only limit is the one a second. Under the box, **OpenStreetMap names** and **Wikidata IDs** open the same text on [Nominatim's search page](https://nominatim.openstreetmap.org/ui/search.html) and Wikidata's search in a new tab, so the exact name or ID can be found there before searching here.

The outlines are OpenStreetMap data under the [ODbL](https://www.openstreetmap.org/copyright), like the lines ridden.

They're saved with the line as `fences`:

```json
{
  "name": "Upper East Side",
  "photos": [24, 28, 31],
  "osm": "R…",
  "shape": [
    [
      [
        [-73.9727, 40.7644],
        [-73.959, 40.7584],
        [-73.942, 40.782],
        [-73.9727, 40.7644]
      ]
    ]
  ]
}
```

`shape` is a GeoJSON `MultiPolygon`'s coordinates: polygons, each an outer ring then any holes, each ring closed. The backend checks that each photo was taken that day and each ring is closed and on the globe. Commit bakes each into `TRIPLINES.geo.json` as a `MultiPolygon` with `"feature": "fence"`, the day, the name and the photos, and counts them (`tripLineFences`).

> **Frontend analogy:** Nominatim is a search API like an autocomplete endpoint, but its answers carry the shape too, the way an image search returns the picture and not only its name. The backend is the one calling it, so the once-a-second limit holds however many tabs are open.
