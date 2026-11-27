import assert from "node:assert/strict";
import { test } from "node:test";
import { type ComparePhoto, compareMediumUrl } from "@/lib/compare-groups";

/** A photo in a compare group with this JSON and R2 image. */
function photo(data: Record<string, unknown>, imageUrl?: string): ComparePhoto {
  return { data, imageUrl } as unknown as ComparePhoto;
}

test("a compared photo shows the Medium image its JSON saves, or else its image in R2", () => {
  assert.equal(compareMediumUrl(photo({ images: { medium: "m.webp" } }, "r2.jpg")), "m.webp");
  assert.equal(compareMediumUrl(photo({ images: { medium: "" } }, "r2.jpg")), "r2.jpg");
  assert.equal(compareMediumUrl(photo({ images: { medium: 3 } }, "r2.jpg")), "r2.jpg");
  assert.equal(compareMediumUrl(photo({}, "r2.jpg")), "r2.jpg");
  assert.equal(compareMediumUrl(photo({})), undefined);
});
