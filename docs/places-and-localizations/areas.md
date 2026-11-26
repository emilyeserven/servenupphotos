# Areas

A place can have an **area**: the outline of what it covers, such as a park or a neighbourhood. The portfolio's map shades it while a visitor points at the place in its **Places** menu, and after picking it (see [the map](../portfolio-map.md)). The portfolio never looks one up: it only reads the files the pipeline saved. A place with no area but with a GPS position is shown as a circle 80 m around its position instead, on the portfolio's map and the Trip Lines map alike (`portfolio/src/lib/place-circle.ts`); nothing is saved for it.

Under the place's fields, **Area on the map** says whether it has one and how many points its outline has. **Find an area** looks up the place's name (or another name, or a Wikidata ID such as `Q1490`) on OpenStreetMap, as the [trip lines' areas](../trip-lines/areas.md) do; picking a result saves it, and **Remove** removes it, both as changes waiting for Commit. The routes are `GET`, `PUT` and `DELETE /api/places/{id}/area`.

The area is saved next to the place as `places/<id>.geo.json`, a GeoJSON `Feature` with a `MultiPolygon` and `{ "place", "osm" }` properties. Like `TRIPLINES.geo.json`, `.geo.json` files are left out of `PLACES.json` by Commit, the "Combine photo data" workflow and `pnpm photos:local`, so outlines of up to 5,000 points don't make every page that reads the places bigger. The pending changes list them with the places.

> **Frontend analogy:** like code splitting. `PLACES.json` is the main bundle every page imports; each area is a lazy chunk (`import.meta.glob` without `eager`) fetched the first time the map shows it.
