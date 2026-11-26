import assert from "node:assert/strict";
import { test } from "node:test";
import { captionOverflows, overflowingCaptions, pastEdges } from "@/lib/caption-overflow";
import type { PhotoBook } from "@/lib/photo-book";

const fits = { scrollWidth: 100, scrollHeight: 50, clientWidth: 100, clientHeight: 50 };

test("a caption overflows when its text is larger than its box or reaches past its room or the page", () => {
  assert.equal(captionOverflows({ ...fits, pastTop: 0, pastRight: 0, pastBottom: -4 }), false);
  assert.equal(
    captionOverflows({ ...fits, scrollHeight: 60, pastTop: 0, pastRight: 0, pastBottom: 0 }),
    true,
  );
  assert.equal(captionOverflows({ ...fits, pastTop: 0, pastRight: 0, pastBottom: 0.5 }), false);
  assert.equal(captionOverflows({ ...fits, pastTop: 0, pastRight: 0, pastBottom: 8 }), true);
  assert.deepEqual(
    pastEdges(
      { top: 5, right: 90, bottom: 120 },
      { top: 20, right: 100, bottom: 110 },
      { top: 10, right: 95, bottom: 200 },
    ),
    { pastTop: 15, pastRight: -5, pastBottom: 10 },
  );
  assert.deepEqual(pastEdges({ top: 0, right: 90, bottom: 120 }, undefined, null), {
    pastTop: -Infinity,
    pastRight: -Infinity,
    pastBottom: -Infinity,
  });
  assert.equal(captionOverflows({ ...fits, pastTop: 6, pastRight: 0, pastBottom: 0 }), true);
});

test("the book's overflowing captions are the ones measured over with the text they have now", () => {
  const book: PhotoBook = {
    id: "b",
    name: "B",
    template: "",
    pages: [
      {
        id: "p1",
        layout: "pair-left",
        title: null,
        slots: [
          { photo: "a", caption: "Long" },
          { photo: "b", caption: "Changed" },
        ],
      },
    ],
  };
  const captions = new Map([
    ["p1:0", { text: "Long", over: true }],
    ["p1:1", { text: "Before", over: true }],
  ]);
  const over = overflowingCaptions(book, captions, (slot) => slot.caption ?? "");
  assert.deepEqual(
    over.map((c) => [c.unit, c.number, c.photo]),
    [["p1", 1, "a"]],
  );
});
