import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aspectProblem, checkAspectRatios } from "@/lib/aspect-ratio";

describe("aspectProblem", () => {
  it("passes the house ratios, with room for rounding to whole pixels", () => {
    assert.equal(aspectProblem(640, 360), null);
    assert.equal(aspectProblem(457, 640), null);
    assert.equal(aspectProblem(641, 360), null);
  });

  it("names what a landscape photo is and how far off 16:9 it is", () => {
    assert.deepEqual(aspectProblem(640, 427), {
      shape: "landscape",
      wanted: "16:9",
      actual: "3:2",
      offBy: 15.7,
    });
  });

  it("checks a portrait photo against 5:7", () => {
    const problem = aspectProblem(512, 640);
    assert.equal(problem?.wanted, "5:7");
    assert.equal(problem?.actual, "4:5");
  });

  it("flags a square photo, and names an uncommon ratio by its numbers", () => {
    assert.equal(aspectProblem(500, 500)?.shape, "square");
    assert.equal(aspectProblem(640, 395)?.actual, "1.62:1");
  });
});

describe("checkAspectRatios", () => {
  const a = { key: "a", imageUrl: "https://cdn.example/a-small.webp" };
  const b = { key: "b", imageUrl: "https://cdn.example/b-small.webp" };
  const c = { key: "c", imageUrl: "https://cdn.example/c-small.webp" };

  it("flags the photos off ratio with a re-edit reason and note, and lists the unread", () => {
    const result = checkAspectRatios(
      [a, b, c],
      [
        { url: a.imageUrl, width: 640, height: 360 },
        { url: b.imageUrl, width: 640, height: 427 },
        { url: c.imageUrl, width: 0, height: 0, error: "Couldn't be read." },
      ],
    );
    assert.equal(result.read, 2);
    assert.deepEqual(result.unread, [c]);
    assert.equal(result.items.length, 1);
    const [item] = result.items;
    assert.ok(item);
    assert.equal(item.entry, b);
    assert.equal(item.flag.reason, "Crop to 16:9");
    assert.equal(
      item.flag.note,
      "Quality Check (aspect ratio): the Small version is 640 × 427 (3:2), not the 16:9 crop for a landscape photo.",
    );
    assert.equal(item.detail, "640 × 427 (3:2), 15.7% off 16:9");
  });
});
