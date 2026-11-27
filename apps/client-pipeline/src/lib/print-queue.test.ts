import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { printPhotoName } from "@/lib/print-queue";

const photos = [
  { id: 1, file: "a.jpg", albums: ["prints"] },
  { id: 2, file: "b.jpg", albums: ["japan"] },
  { id: 3, file: "c.jpg", title: "Canal", albums: ["prints-big"] },
];

describe("printPhotoName", () => {
  it("names a photo by its title, or else its file", () => {
    assert.equal(printPhotoName(photos[2]!), "Canal");
    assert.equal(printPhotoName(photos[0]!), "a.jpg");
  });
});
