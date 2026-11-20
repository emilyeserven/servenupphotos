import assert from "node:assert/strict";
import { test } from "node:test";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { withOthers } from "@/lib/answered-photos";

const photo = (name: string): BulkTagPhoto => ({
  path: `photos/${name}.json`,
  name,
  data: {},
  related: [],
});

test("withOthers adds the answer's other photos after the picked ones, each once", () => {
  const pick = { branch: "b", photos: [photo("a")] };
  const got = withOthers(pick, [photo("b"), photo("a")]);
  assert.deepEqual(
    got.photos.map((p) => p.name),
    ["a", "b"],
  );
  assert.equal(got.branch, "b");
});

test("withOthers keeps the pick as it is when there are no other photos", () => {
  const pick = { photos: [photo("a")] };
  assert.equal(withOthers(pick, []), pick);
  assert.equal(withOthers(pick, undefined), pick);
});
