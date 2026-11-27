import assert from "node:assert/strict";
import { test } from "node:test";
import type { CombinedData } from "@/api/photos";
import { parseLikes, viewerLikes } from "@/api/viewer-likes";

test("a list of likes reads photo IDs from text split at commas and spaces, listing what isn't one", () => {
  assert.deepEqual(parseLikes("12, 3 3; 0 abc"), {
    ids: [3, 12],
    skipped: ["0", "abc"],
    fromLinks: false,
  });
});

test("a list of likes reads a JSON array, or a broken one as text", () => {
  assert.deepEqual(parseLikes('[12, 3, "x"]'), { ids: [3, 12], skipped: ["x"], fromLinks: false });
  assert.deepEqual(parseLikes("[12, 3"), { ids: [3, 12], skipped: [], fromLinks: false });
});

test("people's likes come from the next Commit's lists, sorted by name, or none before they're read", () => {
  const likes = (data?: unknown[]) => ({ likes: { path: "x", found: true, count: 0, data } });
  const ana = { id: "ana", name: "Ana", photos: [1] };
  const bo = { id: "bo", name: "Bo", photos: [2] };
  const data = {
    base: likes([bo]),
    head: likes([bo, ana, "not a person"]),
  } as unknown as CombinedData;
  assert.deepEqual(viewerLikes(data), [ana, bo]);
  assert.deepEqual(viewerLikes({ base: likes([bo]), head: null } as unknown as CombinedData), [bo]);
  assert.deepEqual(viewerLikes(undefined), []);
});
