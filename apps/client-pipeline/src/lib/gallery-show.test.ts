import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoKind } from "@/components/gallery/gallery-files";
import { applyShow, parseShowSearch, showChanged } from "@/lib/gallery-show";

const files: { path: string; kind: PhotoKind }[] = [
  { path: "a.json", kind: "published" },
  { path: "b.json", kind: "draft" },
  { path: "c.json", kind: "undecided" },
  { path: "d.json", kind: "lowerTier" },
];

/** The paths applyShow keeps for the URL's search params. */
function shown(search: Record<string, unknown>): string[] {
  return applyShow(files, parseShowSearch(search)).map(({ path }) => path);
}

test("shows only the published photos at first", () => {
  assert.deepEqual(shown({}), ["a.json"]);
  assert.equal(showChanged(parseShowSearch({})), false);
});

test("shows each group that's turned on, and hides the published ones when turned off", () => {
  assert.deepEqual(shown({ drafts: true, lowerTier: true }), ["a.json", "b.json", "d.json"]);
  assert.deepEqual(shown({ published: false, undecided: true }), ["c.json"]);
  assert.equal(showChanged(parseShowSearch({ drafts: true })), true);
});

test("shows the photo ?photo= names whatever its group", () => {
  assert.deepEqual(shown({ photo: "c.json" }), ["a.json", "c.json"]);
});

test("reads the Gallery's old Shown and Only links", () => {
  assert.deepEqual(shown({ undecided: "show" }), ["a.json", "c.json"]);
  assert.deepEqual(shown({ lowerTier: "only" }), ["d.json"]);
  assert.deepEqual(shown({ undecided: "hidden" }), ["a.json"]);
});

test("keeps the sort and order the URL names, leaving out the default sort", () => {
  assert.deepEqual(parseShowSearch({ sort: "color", order: "desc" }).sort, "color");
  assert.equal(parseShowSearch({ sort: "taken" }).sort, undefined);
  assert.equal(parseShowSearch({ order: "sideways" }).order, undefined);
});
