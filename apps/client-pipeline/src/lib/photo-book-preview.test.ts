import assert from "node:assert/strict";
import { test } from "node:test";
import type { CustomLayout, PhotoBook } from "@/lib/photo-book";
import { frameFits, photoAspect, pickForFrames } from "@/lib/photo-book-preview";

const tall: CustomLayout = {
  id: "custom-1",
  name: "Tall",
  photos: 2,
  arrange: "row",
  shape: "ratio",
  ratio: { width: 4, height: 5 },
  text: "right",
  captions: "column",
  textShare: 30,
  align: "start",
  gap: 2,
  margin: 0,
};

const book: PhotoBook = { id: "b", name: "B", template: "", pages: [], layouts: [tall] };

test("each frame wants photos of its layout's shape", () => {
  assert.deepEqual(frameFits(book, "full", "right"), ["landscape"]);
  assert.deepEqual(frameFits(book, "verticals-left", "left"), ["portrait", "portrait"]);
  assert.deepEqual(frameFits(book, "custom-1", "right"), ["portrait", "portrait"]);
  const filled = { ...book, layouts: [{ ...tall, shape: "fill" as const }] };
  assert.deepEqual(frameFits(filled, "custom-1", "right"), ["any", "any"]);
  assert.deepEqual(frameFits(book, "other", "right"), []);
});

test("a photo's shape comes from its width and height", () => {
  assert.equal(photoAspect({ width: 6000, height: 4000 }), 1.5);
  assert.equal(photoAspect({ width: 0, height: 4000 }), null);
  assert.equal(photoAspect(null), null);
});

/** Photos by name: w is wide, t is tall, ? has no size. */
const aspects: Record<string, number | null> = { w1: 1.5, w2: 1.5, t1: 0.67, t2: 0.75, q: null };

/** The photo's aspect ratio, from aspects. */
const aspect = (p: string) => aspects[p] ?? null;

test("frames are filled with photos of their shape, in order from the start, without repeats", () => {
  const photos = ["w1", "t1", "w2", "t2"];
  const used = new Set<string>();
  assert.deepEqual(pickForFrames(photos, ["portrait", "portrait"], 0, aspect, used), ["t1", "t2"]);
  assert.deepEqual(pickForFrames(photos, ["landscape"], 0, aspect, used), ["w1"]);
  // With no tall photo left, the next one not used yet is taken.
  assert.deepEqual(pickForFrames(photos, ["portrait"], 0, aspect, used), ["w2"]);
  assert.deepEqual(pickForFrames(photos, ["any"], 0, aspect, used), [undefined]);
});

test("the start goes round, and a photo without a size suits any frame", () => {
  assert.deepEqual(pickForFrames(["w1", "q", "t1"], ["portrait"], 1, aspect, new Set()), ["q"]);
  assert.deepEqual(pickForFrames(["w1", "t1"], ["landscape"], 1, aspect, new Set()), ["w1"]);
});
