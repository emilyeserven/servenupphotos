import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addToSet,
  canBeMapped,
  moveSetPhoto,
  photoIdOf,
  removeSetPhoto,
  setsByPhoto,
} from "@/lib/photo-sets";

const set = { id: "market", name: "Market", photos: [1, 2, 3] };

test("adds a photo at the end once, and takes one out", () => {
  const owners = setsByPhoto([set]);
  assert.deepEqual(addToSet(set, { data: { id: 4 } }, owners), {
    set: { ...set, photos: [1, 2, 3, 4] },
    note: "",
  });
  assert.deepEqual(addToSet(set, { data: { id: 2 } }, owners), { set, note: "" });
  assert.deepEqual(addToSet(set, { data: {} }, owners), { set, note: "" });
  assert.deepEqual(removeSetPhoto(set, 2).photos, [1, 3]);
});

test("won't add a photo another set has", () => {
  const other = { id: "b", name: "B", photos: [9] };
  const added = addToSet(set, { data: { id: 9 } }, setsByPhoto([set, other]));
  assert.equal(added.set, set);
  assert.match(added.note, /“B”/);
});

test("moves a photo to another place", () => {
  assert.deepEqual(moveSetPhoto(set, 2, 0).photos, [3, 1, 2]);
});

test("finds each photo's set, the first when it's in two", () => {
  const owners = setsByPhoto([set, { id: "b", name: "B", photos: [3, 9] }]);
  assert.equal(owners.get(3)?.id, "market");
  assert.equal(owners.get(9)?.id, "b");
  assert.equal(owners.get(5), undefined);
});

test("reads a photo's ID and whether the map can place it", () => {
  assert.equal(photoIdOf({ data: { id: 7 } }), 7);
  assert.equal(photoIdOf({ data: {} }), undefined);
  assert.equal(canBeMapped({ data: { gpsPosition: null, places: ["seoul"] } }), true);
  assert.equal(canBeMapped({ data: { customGpsPosition: "37.5, 127" } }), true);
  assert.equal(canBeMapped({ data: { gpsPosition: null, places: [] } }), false);
});
