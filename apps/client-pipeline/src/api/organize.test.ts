import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Group,
  type OrganizeResponse,
  albumAncestry,
  findCollision,
  savedGroups,
} from "@/api/organize";

/** An album with this ID and name, under parent when given. */
function album(id: string, name: string, parent?: string): Group {
  return { id, name, ...(parent && { parent }) } as Group;
}

const japan = album("japan", "Japan");
const tokyo = album("tokyo", "Tokyo", "japan");
const shibuya = album("shibuya", "Shibuya", "tokyo");

test("an album's ancestry runs from the top down to it", () => {
  assert.deepEqual(albumAncestry([shibuya, japan, tokyo], "shibuya"), [japan, tokyo, shibuya]);
  assert.deepEqual(albumAncestry([japan], "japan"), [japan]);
  assert.deepEqual(albumAncestry([japan], "missing"), []);
});

test("an album's ancestry stops at a missing parent or one that comes around again", () => {
  assert.deepEqual(albumAncestry([tokyo], "tokyo"), [tokyo]);
  const a = album("a", "A", "b");
  const b = album("b", "B", "a");
  assert.deepEqual(albumAncestry([a, b], "a"), [b, a]);
});

const organize = {
  albums: [japan],
  tags: [{ id: "sunset", name: "Sunset" }],
  genres: [{ id: "street", name: " Street " }],
} as unknown as OrganizeResponse;

test("a new album, tag or genre collides with one that has its ID or name, ignoring case and spaces", () => {
  assert.deepEqual(findCollision(organize, "id", " JAPAN "), { kind: "albums", group: japan });
  assert.deepEqual(findCollision(organize, "name", "street"), {
    kind: "genres",
    group: organize.genres[0],
  });
  assert.equal(findCollision(organize, "name", "Night"), undefined);
  assert.equal(findCollision(organize, "id", "  "), undefined);
});

test("a photo's saved albums, tags and genres are its lists of IDs; anything else counts as none", () => {
  assert.deepEqual(savedGroups({ albums: ["japan", 3], tags: "sunset", genres: ["street"] }), {
    albums: ["japan"],
    tags: [],
    genres: ["street"],
  });
  assert.deepEqual(savedGroups(undefined), { albums: [], tags: [], genres: [] });
});
