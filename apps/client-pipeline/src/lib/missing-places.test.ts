import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autogroupPhotos } from "@/lib/compare-autogroup";
import type { ComparePhoto } from "@/lib/compare-groups";
import { missingPlaces } from "@/lib/missing-places";

const photo = (name: string, data: Record<string, unknown> = {}): ComparePhoto => ({
  file: { path: `photos/${name}.json`, status: "modified", fileUrl: "", photoName: `${name}.jpg` },
  data: { title: `Title ${name}`, images: { small: `https://cdn/${name}-small.webp` }, ...data },
  fromGallery: false,
});

const gps = { gpsPosition: "35.0, 135.7" };
const photos = autogroupPhotos(
  [
    photo("a-placed", { ...gps, places: [{ id: "kyoto" }] }),
    photo("b-gps", gps),
    photo("c-found", { customGpsPosition: "1, 2", places: [{ name: "draft row" }] }),
    photo("d-nogps"),
    photo("e-marked", { noGps: true }),
    photo("f-casual", { ...gps, casual: true }),
  ],
  { scope: "all", skipGrouped: false },
);

describe("missingPlaces", () => {
  it("lists photos without a saved place, with why, leaving out casual photos", () => {
    const found = missingPlaces(photos, new Set(["photos/c-found.json"]));
    assert.deepEqual(
      found.map(({ entry, reason }) => [entry.key, reason]),
      [
        ["b-gps", "hasGps"],
        ["c-found", "noPlaceFound"],
        ["d-nogps", "noGps"],
        ["e-marked", "markedNoGps"],
      ],
    );
  });
});
