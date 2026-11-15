import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactSheetSets, isContactSheetKey, lookAtPhotos, tileNote } from "@/lib/contact-sheets";

const sheets = [
  { url: "https://cdn.example/contact-sheets/x/sheet-01.jpg", first: 1, last: 30 },
  { url: "https://cdn.example/contact-sheets/x/sheet-02.jpg", first: 31, last: 35 },
];

describe("tileNote", () => {
  it("names the tile and the sheet it's on", () => {
    assert.equal(tileNote(sheets, 0), " (tile 1 on contact sheet 1)");
    assert.equal(tileNote(sheets, 30), " (tile 31 on contact sheet 2)");
  });

  it("adds nothing without sheets or past the last tile", () => {
    assert.equal(tileNote(undefined, 0), "");
    assert.equal(tileNote(sheets, 35), "");
  });
});

describe("lookAtPhotos", () => {
  it("lists each sheet with its tiles", () => {
    const text = lookAtPhotos(sheets, "Open every link.");
    assert.match(text, /^Start with the contact sheets/);
    assert.match(
      text,
      /- Contact sheet 2 \(tiles 31 to 35\): https:\/\/cdn\.example\/contact-sheets\/x\/sheet-02\.jpg$/,
    );
  });

  it("keeps the usual instruction without sheets", () => {
    assert.equal(lookAtPhotos(undefined, "Open every link."), "Open every link.");
    assert.equal(lookAtPhotos([], "Open every link."), "Open every link.");
  });
});

describe("contactSheetSets", () => {
  const image = (key: string, modified: string) => ({ key, size: 100, modified });

  it("puts each folder's sheets in a set, newest set first, leaving out other images", () => {
    const sets = contactSheetSets([
      image("photos/abc-dsc1.jpg", "2026-11-16T00:00:00Z"),
      image("contact-sheets/20261114-010000-aa/sheet-02.jpg", "2026-11-14T01:00:01Z"),
      image("contact-sheets/20261114-010000-aa/sheet-01.jpg", "2026-11-14T01:00:00Z"),
      image("contact-sheets/20261115-010000-bb/sheet-01.jpg", "2026-11-15T01:00:00Z"),
    ]);
    assert.deepEqual(
      sets.map((set) => [set.name, set.sheets.map((sheet) => sheet.key.slice(-12)), set.size]),
      [
        ["20261115-010000-bb", ["sheet-01.jpg"], 100],
        ["20261114-010000-aa", ["sheet-01.jpg", "sheet-02.jpg"], 200],
      ],
    );
    assert.equal(sets[1]?.modified, "2026-11-14T01:00:01Z");
  });

  it("knows a contact sheet's key", () => {
    assert.equal(isContactSheetKey("contact-sheets/x/sheet-01.jpg"), true);
    assert.equal(isContactSheetKey("photos/contact-sheets.jpg"), false);
  });
});
