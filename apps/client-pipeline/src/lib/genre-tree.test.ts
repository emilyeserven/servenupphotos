import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GenreTreeEntry, Group } from "@/api/organize";
import {
  canMoveGenre,
  genreDraft,
  genreTreeChanged,
  genreTreeProblem,
  genreTreeRows,
  moveGenre,
  moveGenreUnder,
  outdentGenre,
  renameGenre,
} from "@/lib/genre-tree";

const entry = (id: string, parent = ""): GenreTreeEntry => ({ id, name: id, parent });

/** Each entry as "id>parent", in order. */
const shape = (entries: GenreTreeEntry[]) => entries.map((e) => `${e.id}>${e.parent}`);

// architecture
//   temples
// street
// nature
const tree = [
  entry("architecture"),
  entry("temples", "architecture"),
  entry("street"),
  entry("nature"),
];

describe("genreDraft", () => {
  it("lists subgenres after their genre and drops parents that aren't genres", () => {
    const genres = [
      { id: "temples", name: "Temples", parent: "architecture" },
      { id: "street", name: "Street", parent: "gone" },
      { id: "architecture", name: "Architecture" },
      { id: "broken", name: "", error: "The file isn't valid JSON." },
    ] as Group[];
    assert.deepEqual(shape(genreDraft(genres)), [
      "street>",
      "architecture>",
      "temples>architecture",
    ]);
  });
});

describe("genreTreeRows", () => {
  it("gives each subgenre one more level of depth", () => {
    assert.deepEqual(
      genreTreeRows(tree).map((row) => row.depth),
      [0, 1, 0, 0],
    );
  });
});

describe("moveGenre", () => {
  it("moves a genre and its subgenres past the one beside it", () => {
    assert.deepEqual(shape(moveGenre(tree, "street", -1)), [
      "street>",
      "architecture>",
      "temples>architecture",
      "nature>",
    ]);
  });

  it("doesn't move past the first or last of its siblings", () => {
    assert.equal(moveGenre(tree, "temples", -1), tree);
    assert.equal(canMoveGenre(tree, "nature", 1), false);
    assert.equal(canMoveGenre(tree, "nature", -1), true);
  });
});

describe("moveGenreUnder", () => {
  it("makes a genre the last subgenre of another", () => {
    assert.deepEqual(shape(moveGenreUnder(tree, "nature", "architecture")), [
      "architecture>",
      "temples>architecture",
      "nature>architecture",
      "street>",
    ]);
  });

  it("never puts a genre under itself or its own subgenre", () => {
    assert.equal(moveGenreUnder(tree, "architecture", "temples"), tree);
    assert.equal(moveGenreUnder(tree, "architecture", "architecture"), tree);
  });
});

describe("outdentGenre", () => {
  it("moves a subgenre up a level, right after its old parent", () => {
    assert.deepEqual(shape(outdentGenre(tree, "temples")), [
      "architecture>",
      "temples>",
      "street>",
      "nature>",
    ]);
  });
});

describe("genreTreeChanged and genreTreeProblem", () => {
  it("notices a rename, and refuses an empty or repeated name", () => {
    assert.equal(genreTreeChanged(tree, renameGenre(tree, "street", "street ")), false);
    assert.equal(genreTreeChanged(tree, renameGenre(tree, "street", "Street photos")), true);
    assert.match(genreTreeProblem(renameGenre(tree, "street", " ")), /name/);
    assert.match(genreTreeProblem(renameGenre(tree, "street", "Nature")), /Two genres/);
    assert.equal(genreTreeProblem(tree), "");
  });
});
