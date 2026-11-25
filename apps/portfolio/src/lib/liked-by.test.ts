import assert from "node:assert/strict";
import { test } from "node:test";
import { likedBy, likeOptions } from "@portfolio/lib/liked-by";

const JANE = { id: "jane", name: "Jane" };
const DK = { id: "dk", name: "DK" };
const PHOTOS = [{ likedBy: [JANE, DK] }, { likedBy: [JANE] }, {}];

test("lists Liked by anyone, then each person by name, with their counts", () => {
  assert.deepEqual(
    likeOptions(PHOTOS).map(({ value, depth, count }) => [value, depth, count]),
    [
      ["_anyone", 0, 2],
      ["dk", 1, 1],
      ["jane", 1, 2],
    ],
  );
});

test("has no choices when no photo says who liked it, as on the portfolio", () => {
  assert.deepEqual(likeOptions([{}, { likedBy: [] }]), []);
});

test("matches a person's likes, or anyone's", () => {
  assert.deepEqual(
    PHOTOS.map((photo) => likedBy(photo, "dk")),
    [true, false, false],
  );
  assert.deepEqual(
    PHOTOS.map((photo) => likedBy(photo, "_anyone")),
    [true, true, false],
  );
});
