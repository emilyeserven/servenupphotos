import assert from "node:assert/strict";
import { test } from "node:test";
import { captionRuns, plainCaption, runClass, withMark } from "@/lib/caption-styles";

test("a caption's style marks split it into stretches, nesting for both", () => {
  assert.deepEqual(captionRuns("A <small>b <i>c</i></small></i> d<i>e"), [
    { text: "A ", small: false, italic: false },
    { text: "b ", small: true, italic: false },
    { text: "c", small: true, italic: true },
    { text: " d", small: false, italic: false },
    { text: "e", small: false, italic: true },
  ]);
  assert.deepEqual(captionRuns(""), []);
});

test("a social media post gets the caption without marks, and a selection can be marked", () => {
  assert.equal(plainCaption("Gate\n<small><i>Seoul</i></small>"), "Gate\nSeoul");
  assert.equal(
    withMark("Gate Seoul", { selectionStart: 5, selectionEnd: 10 }, "small"),
    "Gate <small>Seoul</small>",
  );
  assert.equal(withMark("Gate", null, "i"), "Gate<i></i>");
  assert.equal(runClass({ text: "a", small: true, italic: true }), "text-[0.8em] italic");
  assert.equal(runClass({ text: "a", small: false, italic: false }), undefined);
});
