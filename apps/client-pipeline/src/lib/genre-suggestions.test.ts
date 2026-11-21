import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BulkTagPhotoPlan } from "@/api/bulk-tags";
import type { GenreSuggestionsPreview } from "@/api/genre-suggestions";
import {
  NO_GENRE_CHOICES,
  chosenGenre,
  genresToSave,
  withChosenGenre,
  withChosenParent,
} from "@/lib/genre-suggestions";

const plan = (path: string, add: string[]): BulkTagPhotoPlan => ({
  path,
  name: path,
  add,
  already: [],
  skipped: [],
});

const preview: GenreSuggestionsPreview = {
  photos: [plan("a", ["street", "night"]), plan("b", [])],
  newGenres: [{ id: "night", name: "Night", description: "After dark.", parent: "" }],
  unknown: [],
  others: [],
};

describe("genresToSave", () => {
  it("saves the suggested genres when nothing was changed", () => {
    assert.deepEqual(genresToSave(preview, NO_GENRE_CHOICES), {
      reassign: false,
      newGenres: [{ id: "night", name: "Night", description: "After dark." }],
      photos: [{ path: "a", genres: ["street", "night"] }],
    });
  });

  it("saves the genre picked in a dropdown, once, and none for no genre", () => {
    let choices = withChosenGenre(NO_GENRE_CHOICES, "a", 1, "street");
    choices = withChosenGenre(choices, "b", 0, "portrait");
    assert.deepEqual(genresToSave(preview, choices).photos, [
      { path: "a", genres: ["street"] },
      { path: "b", genres: ["portrait"] },
    ]);
    const none = withChosenGenre(withChosenGenre(NO_GENRE_CHOICES, "a", 0, ""), "a", 1, "");
    assert.deepEqual(genresToSave(preview, none).photos, []);
  });

  it("leaves out a new genre that won't be made, from the photos too", () => {
    const choices = { ...NO_GENRE_CHOICES, dropped: new Set(["night"]) };
    assert.deepEqual(genresToSave(preview, choices), {
      reassign: false,
      newGenres: [],
      photos: [{ path: "a", genres: ["street"] }],
    });
    assert.equal(chosenGenre(choices, "a", 1, "night"), "");
  });

  it("saves a new subgenre under its parent, as the answer gave it or as picked", () => {
    const sub: GenreSuggestionsPreview = {
      ...preview,
      newGenres: [
        { id: "temples", name: "Temples", description: "", parent: "architecture" },
        { id: "shrines", name: "Shrines", description: "", parent: "temples" },
      ],
    };
    assert.deepEqual(
      genresToSave(sub, NO_GENRE_CHOICES).newGenres.map((g) => g.parent),
      ["architecture", "temples"],
    );
    const moved = withChosenParent(NO_GENRE_CHOICES, "temples", "");
    const dropped = { ...moved, dropped: new Set(["temples"]) };
    // Shrines loses its parent when Temples won't be made.
    assert.deepEqual(genresToSave(sub, dropped).newGenres, [
      { id: "shrines", name: "Shrines", description: "" },
    ]);
    assert.equal(genresToSave(sub, moved, true).reassign, true);
  });
});
