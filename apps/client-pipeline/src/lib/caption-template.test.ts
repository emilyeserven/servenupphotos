import assert from "node:assert/strict";
import { test } from "node:test";
import type { CombinedData } from "@/api/photos";
import { captionLists, captionValues } from "@/lib/caption-template";

/** The combined lists with these albums, and a place, at one ref. */
function lists(albums: unknown[]) {
  const file = (data?: unknown[]) => ({ path: "x", found: true, count: 0, ...(data && { data }) });
  return {
    places: file([{ id: "p1", name: "Gate" }]),
    localizations: file(),
    albums: file(albums),
    tags: file([]),
    genres: file([{ id: "street" }]),
  };
}

test("a caption's lists come from the pull request's head, else the base branch, keeping named entries", () => {
  const base = lists([{ id: "old", name: "Old" }]);
  const head = lists([{ id: "japan", name: "Japan" }, "not an entry"]);
  const fromHead = captionLists({ base, head } as unknown as CombinedData);
  assert.deepEqual([...fromHead.names.albums], [["japan", "Japan"]]);
  assert.deepEqual(fromHead.places, [{ id: "p1", name: "Gate" }]);
  assert.deepEqual(fromHead.localizations, []);
  assert.equal(fromHead.names.genres.size, 0);
  const fromBase = captionLists({ base, head: null } as unknown as CombinedData);
  assert.deepEqual([...fromBase.names.albums], [["old", "Old"]]);
});

test("before the lists are read, a caption names nothing", () => {
  const none = captionLists(undefined);
  assert.deepEqual(none.places, []);
  assert.equal(none.names.tags.size, 0);
});

test("a photo between two places fills its place placeholders with “and”", () => {
  const between = {
    places: [
      { id: "kiyo", name: "Kiyo" },
      { id: "uta", name: "Uta" },
    ] as never[],
    localizations: [],
    names: { albums: new Map(), tags: new Map(), genres: new Map() },
  };
  const photo = {
    places: [
      { relation: "between", id: "kiyo" },
      { relation: "and", id: "uta" },
    ],
  };
  const values = captionValues(photo, between);
  assert.equal(values.placesPhrase, "Between Kiyo and Uta");
  assert.equal(values.places, "Kiyo and Uta");
  assert.equal(values.relation1, "between");
  assert.equal(values.relation2, "and");
});
