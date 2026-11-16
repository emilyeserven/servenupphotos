import assert from "node:assert/strict";
import { test } from "node:test";
import { splitSets } from "@portfolio/lib/map-sets";

/** A photo on the map, at a spot. */
function photo(id: number, latitude: number, longitude: number, approximatePosition = false) {
  return { id, latitude, longitude, approximatePosition };
}

const photos = [photo(1, 10, 20), photo(2, 12, 22), photo(3, 50, 50), photo(4, 0, 0, true)];

test("draws a set's photos as one marker in their middle, leaving the rest loose", () => {
  const { sets, loose } = splitSets(photos, [{ id: "a", name: "A", photos: [2, 1] }]);
  assert.equal(sets.length, 1);
  assert.deepEqual(
    sets[0]!.photos.map((p) => p.id),
    [2, 1],
  );
  assert.equal(sets[0]!.latitude, 11);
  assert.equal(sets[0]!.longitude, 21);
  assert.equal(sets[0]!.approximate, false);
  assert.deepEqual(
    loose.map((p) => p.id),
    [3, 4],
  );
});

test("leaves a set with fewer than two photos on the map as loose photos", () => {
  const { sets, loose } = splitSets(photos, [{ id: "a", name: "A", photos: [3, 99] }]);
  assert.equal(sets.length, 0);
  assert.equal(loose.length, 4);
});

test("puts a photo in two sets in the first only", () => {
  const { sets } = splitSets(photos, [
    { id: "a", name: "A", photos: [1, 2] },
    { id: "b", name: "B", photos: [2, 3, 4] },
  ]);
  assert.deepEqual(
    sets.map((set) => set.photos.map((p) => p.id)),
    [
      [1, 2],
      [3, 4],
    ],
  );
});
