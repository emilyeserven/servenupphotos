import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, newPage, setLayout } from "@/lib/photo-book";
import {
  isTextPage,
  setPageText,
  setPhotoPlaces,
  setTextColumns,
  textColumns,
} from "@/lib/photo-book-text";

/** A book whose only page is a full page with photo a. */
function book(): PhotoBook {
  return {
    id: "b",
    name: "B",
    template: "",
    pages: [{ id: "p1", layout: "full", title: null, slots: [{ photo: "a", caption: "A" }] }],
  };
}

test("a new text page has an empty title and text, and no photos", () => {
  const page = newPage(book(), "text");
  assert.equal(page.title, "");
  assert.equal(page.text, "");
  assert.deepEqual(page.slots, []);
  assert.ok(isTextPage(page));
});

test("a page made a text page keeps its photos, without the empty places", () => {
  const b = {
    ...book(),
    pages: [
      {
        ...book().pages[0]!,
        slots: [
          { photo: "", caption: null },
          { photo: "a", caption: "A" },
        ],
      },
    ],
  };
  assert.deepEqual(setLayout(b, 0, "text").pages[0]!.slots, [{ photo: "a", caption: "A" }]);
});

test("the text and its columns are set, the columns kept to 1 to 3", () => {
  const b = setLayout(book(), 0, "text");
  assert.equal(setPageText(b, 0, "**Hi**").pages[0]!.text, "**Hi**");
  assert.equal(setTextColumns(b, 0, 2).pages[0]!.columns, 2);
  assert.equal(setTextColumns(b, 0, 9).pages[0]!.columns, 3);
  assert.equal("columns" in setTextColumns(setTextColumns(b, 0, 2), 0, 1).pages[0]!, false);
  assert.equal(textColumns({}), 1);
  assert.equal(textColumns({ columns: 0 }), 1);
});

test("photo places are added empty and taken off from the end, 0 to 4", () => {
  const b = setLayout(book(), 0, "text");
  assert.deepEqual(setPhotoPlaces(b, 0, 2).pages[0]!.slots, [
    { photo: "a", caption: "A" },
    { photo: "", caption: null },
  ]);
  assert.equal(setPhotoPlaces(b, 0, 9).pages[0]!.slots.length, 4);
  assert.deepEqual(setPhotoPlaces(b, 0, 0).pages[0]!.slots, []);
});
