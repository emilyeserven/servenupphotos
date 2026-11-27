import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPicks, togglePick } from "@/lib/print-picks";

describe("readPicks", () => {
  it("keeps each saved file name once and drops anything else", () => {
    assert.deepEqual(readPicks(["a.jpg", "a.jpg", 3, "", "b.jpg"]), ["a.jpg", "b.jpg"]);
  });

  it("starts with none for nothing saved", () => {
    assert.deepEqual(readPicks(undefined), []);
    assert.deepEqual(readPicks({ a: 1 }), []);
  });
});

describe("togglePick", () => {
  it("hearts a photo, and un-hearts it again", () => {
    const picked = togglePick(["a.jpg"], "b.jpg");
    assert.deepEqual(picked, ["a.jpg", "b.jpg"]);
    assert.deepEqual(togglePick(picked, "a.jpg"), ["b.jpg"]);
  });
});
