import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import {
  addGeneratedPage,
  changeGenerated,
  generatedKind,
  isGeneratedPage,
  setGeneratedTitle,
} from "@/lib/photo-book-generated";

const book: PhotoBook = {
  id: "korea",
  name: "Korea",
  template: "",
  pages: [{ id: "page-1", layout: "full", title: null, slots: [{ photo: "", caption: null }] }],
};

test("a generated page is an other page added at the end of the book, named after its kind", () => {
  const added = addGeneratedPage(book, "places-index");
  const page = added.pages[1];
  assert.deepEqual(page, {
    id: "page-2",
    layout: "other",
    name: "Places Index",
    title: "Places",
    slots: [],
    generated: { kind: "places-index" },
  });
  assert.deepEqual(added.order, ["page-1", "page-2"]);
  assert.ok(page && isGeneratedPage(page));
  assert.ok(!isGeneratedPage(book.pages[0] as PhotoBook["pages"][number]));
  assert.equal(generatedKind("places-index").name, "Places Index");
});

test("a generated page's options are changed and tidied, its title set", () => {
  const added = addGeneratedPage(book, "places-index");
  const changed = changeGenerated(added, "page-2", (g) => ({
    ...g,
    columns: 5,
    pages: 40,
    localized: true,
    hidden: ["city:Seoul"],
  }));
  // A page saved with `localized` is saved with `names` from then on.
  assert.deepEqual(changed.pages[1]?.generated, {
    kind: "places-index",
    columns: 3,
    pages: 20,
    names: "localRomanized",
    hidden: ["city:Seoul"],
  });
  const back = changeGenerated(changed, "page-2", (g) => ({
    ...g,
    columns: 1,
    pages: 1,
    names: undefined,
    hidden: [],
  }));
  assert.deepEqual(back.pages[1]?.generated, { kind: "places-index" });
  assert.equal(setGeneratedTitle(added, "page-2", "Where").pages[1]?.title, "Where");
  // Other pages don't change.
  assert.equal(changeGenerated(added, "page-1", (g) => g).pages[0], added.pages[0]);
});
