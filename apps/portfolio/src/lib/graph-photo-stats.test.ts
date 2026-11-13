import assert from "node:assert/strict";
import { test } from "node:test";
import { lightnessBand, mainColor, PHOTO_STATS } from "@portfolio/lib/graph-photo-stats";
import type { Photo } from "@portfolio/lib/photos";

/** A photo with only what the Graph page's own stats read: an orange street photo unless changed. */
function photo(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    takenAt: new Date(2026, 4, 16, 12),
    albums: [],
    placeIds: [],
    tags: [],
    genres: ["street"],
    palette: [
      { color: "black", share: 0.5 },
      { color: "orange", share: 0.3 },
      { color: "azure", share: 0.2 },
    ],
    lightness: 45,
    image: { width: 300, height: 200 },
    settings: {},
    ...overrides,
  } as Photo;
}

/** The Graph page's own stat with this ID. */
function statById(id: string) {
  const stat = PHOTO_STATS.find((s) => s.id === id);
  assert.ok(stat);
  return stat;
}

/** A stat's rows for the photos, as their labels and counts. */
function counts(stat: string, list: Photo[]): [string, number][] {
  return statById(stat)
    .build(list)
    .rows.map((row) => [row.label, row.count]);
}

test("a photo's main color is its biggest hue, whatever its shades", () => {
  assert.equal(mainColor(photo()), "orange");
});

test("a photo that's nearly all shades is black and white, and one without colors has no main color", () => {
  const gray = photo({
    palette: [
      { color: "gray", share: 0.95 },
      { color: "red", share: 0.05 },
    ],
  });
  assert.equal(mainColor(gray), "Black & white");
  assert.equal(mainColor(photo({ palette: [] })), null);
});

test("Main color counts the photos around the wheel and leaves out colors no photo has", () => {
  const azure = photo({ id: 2, palette: [{ color: "azure", share: 1 }] });
  const list = [photo(), azure, photo({ id: 3 }), photo({ id: 4, palette: [] })];
  assert.deepEqual(counts("mainColor", list), [
    ["Orange", 2],
    ["Azure", 1],
  ]);
  assert.equal(statById("mainColor").build(list).missing, 1);
});

test("a main color's row finds its own photos, so a graph can split by it", () => {
  const list = [photo(), photo({ id: 2, palette: [{ color: "azure", share: 1 }] })];
  const [orange] = statById("mainColor").build(list).rows;
  assert.deepEqual(orange!.filter, { ids: [1] });
});

test("Lightness keeps every band, and an empty band has no photos", () => {
  const list = [photo(), photo({ id: 2, lightness: 100 }), photo({ id: 3, lightness: null })];
  assert.deepEqual(counts("lightness", list), [
    ["Very dark", 0],
    ["Dark", 0],
    ["Medium", 1],
    ["Light", 0],
    ["Very light", 1],
  ]);
  const [veryDark] = statById("lightness").build(list).rows;
  assert.equal(veryDark!.filter, undefined);
  assert.equal(lightnessBand(photo({ lightness: 0 })), 0);
});

test("Genre counts a photo in each of its genres, biggest first", () => {
  const list = [photo(), photo({ id: 2, genres: ["street", "architecture"] })];
  assert.deepEqual(counts("genre", list), [
    ["Street", 2],
    ["Architecture", 1],
  ]);
});

test("Orientation leaves out the ways round no photo is", () => {
  const tall = photo({ id: 2, image: { width: 200, height: 300 } as Photo["image"] });
  assert.deepEqual(counts("orientation", [photo(), tall, photo({ id: 3 })]), [
    ["Horizontal", 2],
    ["Vertical", 1],
  ]);
});
