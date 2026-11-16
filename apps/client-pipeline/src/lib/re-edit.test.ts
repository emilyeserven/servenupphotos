import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markedPhotos } from "@/lib/re-edit";

const photo = (key: string, reEdit?: unknown) => ({ key, data: { reEdit } });

describe("markedPhotos", () => {
  it("lists only marked photos, most recently marked first", () => {
    const photos = [
      photo("a", { reason: "Too warm", date: "2026-10-01" }),
      photo("b", null),
      photo("c"),
      photo("d", { reason: "", date: "2026-11-02" }),
    ];
    const marked = markedPhotos(photos, (p) => p.data);
    assert.deepEqual(
      marked.map((m) => [m.entry.key, m.reEdit.reason]),
      [
        ["d", ""],
        ["a", "Too warm"],
      ],
    );
  });

  it("puts undated marks last, then sorts by key", () => {
    const photos = [photo("img10", {}), photo("img2", {}), photo("x", { date: "2026-01-01" })];
    assert.deepEqual(
      markedPhotos(photos, (p) => p.data).map((m) => m.entry.key),
      ["x", "img2", "img10"],
    );
  });
});
