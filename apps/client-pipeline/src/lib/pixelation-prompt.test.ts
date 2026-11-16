import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autogroupPhotos } from "@/lib/compare-autogroup";
import type { ComparePhoto } from "@/lib/compare-groups";
import { pixelationPrompt, readPixelationAnswer } from "@/lib/pixelation-prompt";

const photo = (name: string, data: Record<string, unknown> = {}): ComparePhoto => ({
  file: { path: `photos/${name}.json`, status: "modified", fileUrl: "", photoName: `${name}.jpg` },
  data: { title: `Title ${name}`, images: { small: `https://cdn/${name}-small.webp` }, ...data },
  fromGallery: false,
});

const photos = autogroupPhotos(
  [photo("street"), photo("cafe", { faces: [{ x: 1, y: 1, width: 5, height: 5, blocks: 8 }] })],
  { scope: "all", skipGrouped: false },
);

describe("pixelationPrompt", () => {
  it("links every photo, notes the ones pixelated already and asks for JSON", () => {
    const prompt = pixelationPrompt(photos);
    assert.match(prompt, /Photo "street": https:\/\/cdn\/street-small\.webp/);
    assert.match(
      prompt,
      /Photo "cafe": [^\n]+\n- Title: Title cafe\n- Some areas are pixelated already/,
    );
    assert.match(prompt, /"pixelate": \["face", "license plate"\]/);
  });

  it("links the contact sheets and each photo's tile when there are sheets", () => {
    const prompt = pixelationPrompt(photos, [
      { url: "https://cdn/sheet-01.jpg", first: 1, last: 2 },
    ]);
    assert.match(prompt, /Contact sheet 1 \(tiles 1 to 2\): https:\/\/cdn\/sheet-01\.jpg/);
    assert.match(prompt, /Photo "street" \(tile 2 on contact sheet 1\)/);
  });
});

describe("readPixelationAnswer", () => {
  it("reads each flagged photo's reason and note, once, and lists names it doesn't know", () => {
    const answer = `Here you go:
\`\`\`json
{ "photos": [
  { "photo": "Street", "pixelate": ["license plate"], "reEdit": "Pixelate the plate", "note": "The taxi's plate is readable." },
  { "photo": "street.json", "pixelate": ["face"] },
  { "photo": "beach", "pixelate": ["face"] }
] }
\`\`\``;
    const { flagged, unknown } = readPixelationAnswer(answer, photos);
    const [first] = flagged;
    assert.ok(first && flagged.length === 1);
    assert.equal(first.entry.key, "street");
    assert.deepEqual(first.pixelate, ["license plate"]);
    assert.deepEqual(first.flag, {
      reason: "Pixelate the plate",
      note: "Quality Check (pixelation): The taxi's plate is readable.",
    });
    assert.deepEqual(unknown, ["beach"]);
  });

  it("makes up a reason and note from what to hide when the answer gives none", () => {
    const { flagged } = readPixelationAnswer(
      '{"photos":[{"photo":"cafe","pixelate":["face"]}]}',
      photos,
    );
    assert.deepEqual(flagged[0]?.flag, {
      reason: "Pixelate face",
      note: "Quality Check (pixelation): Shows face to pixelate.",
    });
  });

  it("says when the answer has no photos list", () => {
    assert.throws(() => readPixelationAnswer('{"groups":[]}', photos), /no "photos" list/);
  });
});
