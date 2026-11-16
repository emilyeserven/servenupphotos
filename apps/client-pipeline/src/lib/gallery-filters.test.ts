import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "@/api/places";
import { GALLERY_FILTER_KEYS, galleryFilters } from "@/lib/gallery-filters";
import { matchesFilters, parseFilters } from "@/lib/photo-data-filters";

const places = [
  { id: "seoul", name: "Seoul", latitude: 37.5665, longitude: 126.978 },
  { id: "cafe", name: "A cafe", parent: "seoul" },
  { id: "nowhere", name: "Nowhere" },
] as unknown as Place[];

const filters = galleryFilters(places);
const onMap = (data: object) => matchesFilters(data, { map: "with" }, filters);

test("a photo with its own GPS position is on the map", () => {
  assert.equal(onMap({ gpsPosition: `37 deg 31' 21.06" N, 126 deg 58' 46.24" E` }), true);
  assert.equal(onMap({ customGpsPosition: "40.7795, -73.9634" }), true);
});

test("a photo without one is on the map at a place, or a place that place is in", () => {
  assert.equal(onMap({ places: [{ id: "cafe", relation: "in" }] }), true);
  assert.equal(onMap({ places: [{ id: "nowhere", relation: "in" }] }), false);
  assert.equal(onMap({}), false);
});

test("a GPS position the map can't read doesn't put a photo on it", () => {
  assert.equal(onMap({ gpsPosition: "somewhere" }), false);
  assert.equal(matchesFilters({ gpsPosition: "somewhere" }, { map: "without" }, filters), true);
});

test("the Gallery reads On the map from the URL, and not GPS position", () => {
  const search = { hasMap: "without", hasGps: "with" };
  assert.deepEqual(parseFilters(search, "has", GALLERY_FILTER_KEYS), { map: "without" });
});
