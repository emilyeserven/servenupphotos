import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { askedPhotos, autogroupAsk, autogroupPrompt } from "@/lib/compare-autogroup";
import type { ComparePhoto } from "@/lib/compare-groups";

const photo = (name: string, data: Record<string, unknown> = {}): ComparePhoto => ({
  file: { path: `photos/${name}.json`, status: "modified", fileUrl: "", photoName: `${name}.jpg` },
  data: { title: `Title ${name}`, images: { small: `https://cdn/${name}-small.webp` }, ...data },
  fromGallery: false,
});

const photos = [
  photo("c", { createDate: "2024:05:01 10:00:03" }),
  photo("a", { createDate: "2024:05:01 10:00:01" }),
  photo("draft", { title: "", createDate: "2024:05:01 09:00:00" }),
  photo("grouped", { compareGroup: "Lanterns", compareWinner: true }),
  photo("grouped2", { compareGroup: "Lanterns" }),
  photo("gone", { unselected: { reason: "" } }),
  photo("noimage", { images: {} }),
];

const keys = (list: { key: string }[]) => list.map((entry) => entry.key);

describe("autogroupAsk", () => {
  it("lists every photo in no group with an image, oldest first, and the groups there are", () => {
    const ask = autogroupAsk(photos, { scope: "all", withGroups: true });
    assert.deepEqual(keys(ask.loose), ["draft", "a", "c"]);
    assert.deepEqual(
      ask.groups.map((group) => [group.name, keys(group.photos)]),
      [["Lanterns", ["grouped", "grouped2"]]],
    );
    assert.deepEqual(keys(askedPhotos(ask)), ["draft", "a", "c", "grouped", "grouped2"]);
  });

  it("leaves the groups out when the LLM may not change them", () => {
    assert.deepEqual(autogroupAsk(photos, { scope: "all", withGroups: false }).groups, []);
  });

  it("lists only the drafts", () => {
    assert.deepEqual(keys(autogroupAsk(photos, { scope: "drafts", withGroups: false }).loose), [
      "draft",
    ]);
  });

  it("reads when each photo was taken, the custom date first", () => {
    const [entry] = autogroupAsk(
      [photo("x", { createDate: "2024:05:01 10:00:01", customCreateDate: "2023-01-02T03:04:05" })],
      { scope: "all", withGroups: false },
    ).loose;
    assert.equal(entry?.takenAt, "2023-01-02 03:04:05");
  });
});

describe("autogroupPrompt", () => {
  it("links each photo's Small image and sends the groups, with merge and remove", () => {
    const prompt = autogroupPrompt(autogroupAsk(photos, { scope: "all", withGroups: true }));
    assert.match(prompt, /Photo "a": https:\/\/cdn\/a-small\.webp\n- Taken: 2024-05-01 10:00:01/);
    assert.match(prompt, /Group "Lanterns" \(2 photos\):\nPhoto "grouped"/);
    assert.match(prompt, /- Picked as a winner of its group/);
    assert.match(prompt, /A group can have any number of photos/);
    assert.match(prompt, /"merge": \[/);
    assert.match(prompt, /"remove": \[/);
  });

  it("asks only for new groups without the groups there are", () => {
    const prompt = autogroupPrompt(autogroupAsk(photos, { scope: "all", withGroups: false }));
    assert.doesNotMatch(prompt, /"merge"|Compare groups I have already/);
  });
});
