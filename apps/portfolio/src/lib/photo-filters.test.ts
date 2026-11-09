import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterCount,
  filterPhotos,
  hasFilters,
  locationFilters,
  locationSelection,
  matchesFilters,
  NO_STATE,
  parseFilters,
  withoutFilters,
} from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";

/** A photo with only what the shared filters read, in Seoul unless changed. */
function photo(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    takenAt: new Date(2026, 4, 16, 12),
    country: "South Korea",
    state: null,
    city: "Seoul",
    placeIds: ["gyeongbokgung"],
    albums: ["no-such-album"],
    tags: [],
    genres: ["street"],
    ...overrides,
  } as Photo;
}

test("keeps one location as text and several as a list", () => {
  assert.deepEqual(parseFilters({ city: "Seoul" }), { city: "Seoul" });
  assert.deepEqual(parseFilters({ city: ["Seoul", "Busan"] }), { city: ["Seoul", "Busan"] });
  assert.deepEqual(parseFilters({ city: ["Seoul"] }), { city: "Seoul" });
});

test("leaves out empty, non-text and unknown filters", () => {
  assert.deepEqual(parseFilters({ city: "", country: [1, ""], album: 3, bogus: "x" }), {});
  assert.equal(hasFilters(parseFilters({})), false);
});

test("reads the photos chosen one by one, keeping only whole numbers", () => {
  assert.deepEqual(parseFilters({ ids: [3, 1.5, "7", 9] }), { ids: [3, 9] });
  assert.deepEqual(parseFilters({ ids: [] }), {});
});

test("counts every country, city, place, group and the photos chosen", () => {
  const filters = parseFilters({ country: ["A", "B"], album: "trip", month: ["may"], ids: [1] });
  assert.equal(filterCount(filters), 5);
  assert.equal(filterCount({}), 0);
});

test("matches a photo to any of several chosen locations", () => {
  const filters = parseFilters({ city: ["Busan", "Seoul"] });
  assert.equal(matchesFilters(photo(), filters), true);
  assert.equal(matchesFilters(photo({ city: "Tokyo" }), filters), false);
});

test("needs a photo to match every kind of filter that's set", () => {
  assert.equal(matchesFilters(photo(), { city: "Seoul", genre: "street" }), true);
  assert.equal(matchesFilters(photo(), { city: "Seoul", genre: "portrait" }), false);
  assert.equal(matchesFilters(photo(), { place: "gyeongbokgung" }), true);
  assert.equal(matchesFilters(photo(), { ids: [2, 3] }), false);
  assert.equal(matchesFilters(photo(), { ids: [1] }), true);
});

test("matches a photo with no state when the state is none", () => {
  assert.equal(matchesFilters(photo(), { state: NO_STATE }), true);
  assert.equal(matchesFilters(photo({ state: "Gyeonggi" }), { state: NO_STATE }), false);
  assert.equal(matchesFilters(photo({ state: "Gyeonggi" }), { state: "Gyeonggi" }), true);
});

test("matches an album that isn't known by its own ID", () => {
  assert.equal(matchesFilters(photo(), { album: "no-such-album" }), true);
  assert.equal(matchesFilters(photo(), { album: "other" }), false);
});

test("returns the same list when no filter is set, else the matches in order", () => {
  const list = [photo({ id: 1 }), photo({ id: 2, city: "Tokyo" }), photo({ id: 3 })];
  assert.equal(filterPhotos(list, {}), list);
  assert.deepEqual(
    filterPhotos(list, { city: "Seoul" }).map((p) => p.id),
    [1, 3],
  );
});

test("leaves out the filters named", () => {
  const filters = parseFilters({ city: "Seoul", genre: "street", month: ["may"], ids: [1] });
  assert.deepEqual(withoutFilters(filters, ["city", "month", "ids"]), { genre: "street" });
});

test("turns locations into the Places filter's values and back", () => {
  const filters = parseFilters({ country: "South Korea", city: ["Seoul", "Busan"] });
  const selection = locationSelection(filters);
  assert.deepEqual(selection, ["country:South Korea", "city:Seoul", "city:Busan"]);
  assert.deepEqual(locationFilters(selection), filters);
});

test("keeps a colon inside a location's name", () => {
  assert.deepEqual(locationFilters(["place:a:b"]), { place: "a:b" });
});
