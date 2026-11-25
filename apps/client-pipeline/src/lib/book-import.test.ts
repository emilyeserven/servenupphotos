import assert from "node:assert/strict";
import { test } from "node:test";
import { importedBook, importedPhotos, readBookImport } from "@/lib/book-import";
import { bookImportPrompt, catalogPhotos } from "@/lib/book-import-prompt";
import { importSaves } from "@/lib/book-import-save";

const photo = (name: string, day = "") => ({
  path: `apps/portfolio/src/data/photos/${name}.json`,
  data: { createDate: day ? `${day.replaceAll("-", ":")} 10:00:00` : "", file: `${name}.JPG` },
});

const PHOTOS = [photo("DSCF2", "2022-07-20"), photo("DSCF1", "2021-02-07"), photo("undated")];

test("the catalog keeps photos taken between the dates, oldest first, and undated ones only when no date is set", () => {
  const names = (list: typeof PHOTOS) => list.map((p) => p.path.split("/").at(-1));
  assert.deepEqual(names(catalogPhotos(PHOTOS, { from: "", to: "" })), [
    "DSCF1.json",
    "DSCF2.json",
    "undated.json",
  ]);
  assert.deepEqual(names(catalogPhotos(PHOTOS, { from: "2022-01-01", to: "" })), ["DSCF2.json"]);
  assert.deepEqual(names(catalogPhotos(PHOTOS, { from: "", to: "2021-02-07" })), ["DSCF1.json"]);
});

test("the prompt names each photo, the layouts, and how to count pages for images", () => {
  const prompt = bookImportPrompt({
    source: "images",
    photos: PHOTOS.slice(0, 1),
    dates: { from: "2022-01-01", to: "" },
  });
  assert.match(prompt, /- "DSCF2"/);
  assert.match(prompt, /"verticals-left"/);
  assert.match(prompt, /on or after 2022-01-01/);
  assert.match(prompt, /two for each image of a spread/);
});

const ANSWER = `Here it is:
\`\`\`json
{
  "book": { "name": "Vol. 3", "description": "A year of photos." },
  "notOnWebsite": [{ "page": 4, "printedTitle": "Snowy Park", "description": "A snowy park." }],
  "pages": [
    { "page": 4, "layout": "pair-left", "title": "WINTER", "photos": [
      { "photo": "dscf1.json", "caption": null },
      { "photo": "", "printedTitle": "Snowy Park", "caption": null }
    ] },
    { "page": 5, "layout": "full", "title": null, "photos": [
      { "photo": "DSCF2", "caption": "Last light." },
      { "photo": "DSCF1", "caption": null },
      { "photo": "nope", "caption": null }
    ] }
  ]
}
\`\`\``;

test("an answer is matched to the photos, and a page with too many photos is split", () => {
  const read = readBookImport(ANSWER, PHOTOS);
  assert.equal(read.name, "Vol. 3");
  assert.deepEqual(read.unknown, ["nope"]);
  assert.equal(read.missing[0]?.printedTitle, "Snowy Park");
  assert.deepEqual(
    read.pages.map((page) => [page.layout, page.title, page.slots.length]),
    [
      ["pair-left", "WINTER", 2],
      ["full", null, 1],
      ["full", null, 1],
      ["full", null, 1],
    ],
  );
  // DSCF1 is already on page 4, so its second place is left empty.
  assert.deepEqual(importedPhotos(read), [PHOTOS[1]?.path, PHOTOS[0]?.path]);
});

test("the imported book has every place its layouts hold, with the album and captions", () => {
  const read = readBookImport(ANSWER, PHOTOS);
  const book = importedBook(read, { id: "vol-3", name: "Vol. 3", album: "vol-3" });
  assert.equal(book.album, "vol-3");
  assert.equal(book.template, "");
  assert.deepEqual(book.order, ["page-1", "page-2", "page-3", "page-4"]);
  assert.deepEqual(book.pages[0], {
    id: "page-1",
    layout: "pair-left",
    title: "WINTER",
    slots: [
      { photo: PHOTOS[1]?.path, caption: null },
      { photo: "", caption: null },
    ],
  });
  assert.equal(book.pages[1]?.slots[0]?.caption, "Last light.");
});

test("an answer without pages says so", () => {
  assert.throws(() => readBookImport('{"book": {}}', PHOTOS), /no "pages" list/);
});

test("an import makes a new album of the matched photos in book order, then the book", () => {
  const read = readBookImport(ANSWER, PHOTOS);
  const saves = importSaves(
    read,
    { name: "Vol. 3", hidden: true },
    {
      albums: [{ id: "winter", name: "Winter" }],
      bookId: () => "vol-3",
      photoIds: new Map([
        [PHOTOS[0]?.path ?? "", 2],
        [PHOTOS[1]?.path ?? "", 1],
      ]),
    },
  );
  assert.deepEqual(saves.album, { id: "vol-3", existing: false });
  assert.deepEqual(saves.albumSaves[0]?.newAlbums, [
    { id: "vol-3", name: "Vol. 3", description: "A year of photos.", hidden: true },
  ]);
  assert.deepEqual(saves.photoOrder, [1, 2]);
  assert.equal(saves.book.album, "vol-3");
});

test("an import adds to an album with the name already, keeping its order", () => {
  const read = readBookImport(ANSWER, PHOTOS);
  const saves = importSaves(
    read,
    { name: "winter", hidden: true },
    { albums: [{ id: "winter", name: "Winter" }], bookId: () => "winter", photoIds: new Map() },
  );
  assert.deepEqual(saves.album, { id: "winter", existing: true });
  assert.deepEqual(saves.albumSaves[0]?.newAlbums, []);
  assert.deepEqual(saves.photoOrder, []);
});

test("an import without matched photos makes only the book", () => {
  const read = readBookImport('{"pages": [{"layout": "full", "photos": [{"photo": ""}]}]}', PHOTOS);
  const saves = importSaves(
    read,
    { name: "Old", hidden: true },
    { albums: [], bookId: () => "old", photoIds: new Map() },
  );
  assert.deepEqual(saves.albumSaves, []);
  assert.equal(saves.book.album, "");
});
