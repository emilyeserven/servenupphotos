import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { albumAndInside, type BookAlbum, filesInOrder } from "@/lib/photo-book-album";

/** A photo file with the ID id. */
const file = (id: number): SocialPhoto =>
  ({ path: `${id}.json`, data: { id } }) as unknown as SocialPhoto;

test("a book's album takes in the albums inside it, at any depth", () => {
  const albums = [
    { id: "korea", name: "Korea" },
    { id: "seoul", name: "Seoul", parent: "korea" },
    { id: "gangnam", name: "Gangnam", parent: "seoul" },
    { id: "japan", name: "Japan", parent: null },
  ] as BookAlbum[];
  assert.deepEqual([...albumAndInside(albums, "korea")].toSorted(), ["gangnam", "korea", "seoul"]);
  assert.deepEqual([...albumAndInside(albums, "japan")], ["japan"]);
});

test("the album's photos come back as files in its order, without ones that have no file", () => {
  const files = [1, 2, 3].map(file);
  const ordered = [{ id: 3 }, { id: 9 }, { id: 1 }, {}];
  assert.deepEqual(
    filesInOrder(files, ordered).map((f) => f.path),
    ["3.json", "1.json"],
  );
});
