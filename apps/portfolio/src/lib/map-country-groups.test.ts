import assert from "node:assert/strict";
import { test } from "node:test";
import {
  byCountrySource,
  COUNTRY_MAX_ZOOM,
  countrySourceId,
  groupingSources,
  isPhotoSource,
  SOURCE_ID,
} from "@portfolio/lib/map-country-groups";

test("splits photos by country, keeping their order, with no country sharing one source", () => {
  const photos = [
    { id: 1, country: "Japan" },
    { id: 2, country: "South Korea" },
    { id: 3, country: null },
    { id: 4, country: "Japan" },
  ];
  const groups = byCountrySource(photos);
  assert.deepEqual(
    [...groups].map(([id, points]) => [id, points.map((photo) => photo.id)]),
    [
      [countrySourceId("Japan"), [1, 4]],
      [countrySourceId("South Korea"), [2]],
      [countrySourceId(null), [3]],
    ],
  );
});

test("groups by country only when zoomed out below the threshold", () => {
  const countries = [countrySourceId("Japan"), countrySourceId("Egypt")];
  assert.deepEqual(groupingSources(2, countries), countries);
  assert.deepEqual(groupingSources(COUNTRY_MAX_ZOOM - 0.1, countries), countries);
  assert.deepEqual(groupingSources(COUNTRY_MAX_ZOOM, countries), [SOURCE_ID]);
  assert.deepEqual(groupingSources(14, countries), [SOURCE_ID]);
});

test("knows the photo sources from the map's other sources", () => {
  assert.equal(isPhotoSource(SOURCE_ID), true);
  assert.equal(isPhotoSource(countrySourceId("Belgium")), true);
  assert.equal(isPhotoSource(countrySourceId(null)), true);
  assert.equal(isPhotoSource("trip-lines"), false);
});
