import assert from "node:assert/strict";
import { test } from "node:test";
import { bookOptions, inBook } from "@portfolio/lib/in-book";

const KOREA = { id: "korea", name: "Korea" };
const YEAR = { id: "2026", name: "2026" };
const PHOTOS = [{ books: [KOREA, YEAR] }, { books: [KOREA] }, {}];

test("lists each book by name, with how many of the photos are in it", () => {
  assert.deepEqual(
    bookOptions(PHOTOS).map(({ value, count }) => [value, count]),
    [
      ["2026", 1],
      ["korea", 2],
    ],
  );
});

test("has no choices when no photo says which books it's in, as on the portfolio", () => {
  assert.deepEqual(bookOptions([{}, { books: [] }]), []);
});

test("matches the photos placed in the book", () => {
  assert.deepEqual(
    PHOTOS.map((photo) => inBook(photo, "2026")),
    [true, false, false],
  );
});
