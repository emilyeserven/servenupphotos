import assert from "node:assert/strict";
import { test } from "node:test";
import type { SanitizedExif } from "@/api/exif";
import { photoData } from "@/lib/photo-data";

const groups = { albums: ["seoul"], tags: ["night"], genres: [] };

test("photoData moves the places and noGps out of the sanitized EXIF", () => {
  const sanitized = {
    title: "Lanterns",
    places: [{ relation: "in", id: "seoul" }],
    noGps: true,
  } as unknown as SanitizedExif;
  assert.deepEqual(photoData("lanterns", "DSCF1482-2.jpg", sanitized, groups), {
    name: "lanterns",
    file: "DSCF1482-2.jpg",
    sanitized: { title: "Lanterns" },
    albums: ["seoul"],
    tags: ["night"],
    genres: [],
    places: [{ relation: "in", id: "seoul" }],
    noGps: true,
  });
});

test("photoData sends no places and noGps false when the photo has neither", () => {
  const sanitized = { title: null } as unknown as SanitizedExif;
  const body = photoData("dscf1482-2", "DSCF1482-2.jpg", sanitized, groups);
  assert.deepEqual(body.sanitized, { title: null });
  assert.deepEqual(body.places, []);
  assert.equal(body.noGps, false);
});
