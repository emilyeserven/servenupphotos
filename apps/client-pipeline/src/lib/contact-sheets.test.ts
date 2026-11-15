import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookAtPhotos, tileNote } from "@/lib/contact-sheets";

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
