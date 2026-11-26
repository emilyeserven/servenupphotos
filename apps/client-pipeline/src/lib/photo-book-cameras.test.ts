import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookCameraName,
  cameraNameNote,
  withBookCameraName,
  withCameraName,
} from "@/lib/photo-book-cameras";

test("a book's captions write a camera by its name in the book, or as it is", () => {
  const names = [{ camera: "Fujifilm X-T5", name: "X-T5" }];
  assert.equal(bookCameraName("Fujifilm X-T5", names), "X-T5");
  assert.equal(bookCameraName("Sony A7", names), "Sony A7");
  assert.equal(
    bookCameraName("Fujifilm X-T5", [{ camera: "Fujifilm X-T5", name: " " }]),
    "Fujifilm X-T5",
  );
  assert.equal(bookCameraName("Fujifilm X-T5", undefined), "Fujifilm X-T5");
});

test("a camera's name in the book is set, replaced or taken off", () => {
  const one = withCameraName(undefined, "A", "x");
  assert.deepEqual(withCameraName(one, "A", "y"), [{ camera: "A", name: "y" }]);
  assert.deepEqual(withCameraName(one, "A", ""), []);
  assert.deepEqual(withCameraName(one, "A", "  "), []);
});

test("a photo's camera is renamed in its fields, and the Info tab says how", () => {
  const names = [{ camera: "Fujifilm X-T5", name: "X-T5" }];
  assert.deepEqual(withBookCameraName({ camera: "Fujifilm X-T5", iso: 200 }, names), {
    camera: "X-T5",
    iso: 200,
  });
  assert.deepEqual(withBookCameraName({ iso: 200 }, names), { iso: 200 });
  assert.equal(cameraNameNote("Fujifilm X-T5", names), "Captions say X-T5");
  assert.equal(cameraNameNote("Sony A7", names), "Written as it is");
});
