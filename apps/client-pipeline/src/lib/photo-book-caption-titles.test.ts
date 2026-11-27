import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookCaption,
  firstLine,
  titleAndRest,
  templateHasTitle,
  untitledCaption,
} from "@/lib/photo-book-caption-titles";

const template = {
  template: "{title}\n\n{date}\n{city}",
  places: [],
  placeReplacements: [],
} as never;

test("a template caption starts with a title only when its first line fills in", () => {
  assert.equal(templateHasTitle(template, { title: "Palace", date: "May 1", city: "Seoul" }), true);
  assert.equal(templateHasTitle(template, { title: "", date: "May 1", city: "Seoul" }), false);
  assert.equal(templateHasTitle({ ...(template as object), template: "\n" } as never, {}), false);
});

test("an untitled caption starts with one blank line", () => {
  assert.equal(untitledCaption("May 1\nSeoul"), "\nMay 1\nSeoul");
  assert.equal(untitledCaption("\n\nMay 1"), "\nMay 1");
  assert.equal(untitledCaption(""), "");
});

test("a caption with a blank first line has no title", () => {
  assert.deepEqual(titleAndRest("Palace\n\nMay 1"), { title: "Palace", rest: "May 1" });
  assert.deepEqual(titleAndRest("\nMay 1\nSeoul"), { title: "", rest: "May 1\nSeoul" });
  assert.deepEqual(titleAndRest("Palace"), { title: "Palace", rest: "" });
});

test("a caption is named by its first line with text", () => {
  assert.equal(firstLine("\n<i>May 1</i>\nSeoul"), "May 1");
  assert.equal(firstLine(""), "");
});

const filled = "Palace\n\nMay 1\nSeoul";

test("a template caption keeps its title unless it's hidden for the photo or the book", () => {
  const base = { titled: true, hidden: undefined, noCaptionTitles: undefined };
  assert.equal(bookCaption(filled, base), filled);
  assert.equal(bookCaption(filled, { ...base, hidden: ["line:0"] }), "\nMay 1\nSeoul");
  assert.equal(bookCaption(filled, { ...base, noCaptionTitles: true }), "\nMay 1\nSeoul");
  assert.equal(
    bookCaption(filled, { ...base, noCaptionTitles: true, hidden: ["line:3"] }),
    "\nMay 1",
  );
});

test("a template caption whose photo has no title draws its first line as caption text", () => {
  const settings = { titled: false, hidden: undefined, noCaptionTitles: undefined };
  assert.equal(bookCaption("May 1\nSeoul", settings), "\nMay 1\nSeoul");
  assert.equal(
    bookCaption("May 1\nSeoul", { ...settings, noCaptionTitles: true }),
    "\nMay 1\nSeoul",
  );
});
