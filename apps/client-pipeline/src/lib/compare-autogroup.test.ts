import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autogroupBatchSize,
  autogroupBatches,
  autogroupPhotos,
  autogroupPrompt,
  movingPhotos,
  readAutogroupAnswer,
} from "@/lib/compare-autogroup";
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
  photo("grouped", { compareGroup: "Lanterns", createDate: "2024:05:02 08:00:00" }),
  photo("gone", { unselected: { reason: "" } }),
  photo("noimage", { images: {} }),
];

const keys = (list: { key: string }[]) => list.map((entry) => entry.key);

describe("autogroupPhotos", () => {
  it("lists every photo with an image, oldest first, leaving out unselected ones", () => {
    assert.deepEqual(keys(autogroupPhotos(photos, { scope: "all", skipGrouped: false })), [
      "draft",
      "a",
      "c",
      "grouped",
    ]);
  });

  it("leaves out photos already in a group when asked", () => {
    assert.deepEqual(keys(autogroupPhotos(photos, { scope: "all", skipGrouped: true })), [
      "draft",
      "a",
      "c",
    ]);
  });

  it("lists only the drafts", () => {
    assert.deepEqual(keys(autogroupPhotos(photos, { scope: "drafts", skipGrouped: false })), [
      "draft",
    ]);
  });

  it("reads when each photo was taken, the custom date first", () => {
    const [entry] = autogroupPhotos(
      [photo("x", { createDate: "2024:05:01 10:00:01", customCreateDate: "2023-01-02T03:04:05" })],
      { scope: "all", skipGrouped: false },
    );
    assert.equal(entry?.takenAt, "2023-01-02 03:04:05");
  });
});

describe("autogroupBatches", () => {
  it("splits the photos into batches of the size chosen", () => {
    const all = autogroupPhotos(photos, { scope: "all", skipGrouped: false });
    assert.deepEqual(autogroupBatches(all, 3).map(keys), [["draft", "a", "c"], ["grouped"]]);
  });

  it("reads the typed size, falling back to 50 and stopping at 200", () => {
    assert.equal(autogroupBatchSize("abc"), 50);
    assert.equal(autogroupBatchSize("0"), 50);
    assert.equal(autogroupBatchSize("12"), 12);
    assert.equal(autogroupBatchSize("900"), 200);
  });
});

describe("autogroupPrompt", () => {
  it("links each photo's Small image and names the groups there are", () => {
    const prompt = autogroupPrompt(autogroupPhotos(photos, { scope: "all", skipGrouped: false }));
    assert.match(prompt, /Photo "a": https:\/\/cdn\/a-small\.webp\n- Taken: 2024-05-01 10:00:01/);
    assert.match(prompt, /- Already in the group: Lanterns/);
    assert.match(prompt, /Groups some of these photos are in already:\n- Lanterns/);
  });
});

describe("readAutogroupAnswer", () => {
  const batch = autogroupPhotos(photos, { scope: "all", skipGrouped: false });

  it("reads the groups from JSON in a code fence, looking photos up by name", () => {
    const answer = readAutogroupAnswer(
      '```json\n{ "groups": [ { "name": "Morning", "photos": ["a", "C.json", "nope"] } ] }\n```',
      batch,
      photos,
    );
    assert.deepEqual(
      answer.groups.map((group) => [group.name, keys(group.photos), group.existing]),
      [["Morning", ["a", "c"], false]],
    );
    assert.deepEqual(answer.unknown, ["nope"]);
  });

  it("keeps a photo in its first group and drops groups left with one photo", () => {
    const answer = readAutogroupAnswer(
      '{ "groups": [ { "name": "One", "photos": ["a", "c"] }, { "name": "Two", "photos": ["c", "draft"] } ] }',
      batch,
      photos,
    );
    assert.deepEqual(
      answer.groups.map((group) => group.name),
      ["One"],
    );
  });

  it("adds one photo to a group there is already", () => {
    const answer = readAutogroupAnswer(
      '{ "groups": [ { "name": "Lanterns", "photos": ["a"] } ] }',
      batch,
      photos,
    );
    assert.equal(answer.groups[0]?.existing, true);
  });

  it("says which photos move out of another group", () => {
    const answer = readAutogroupAnswer(
      '{ "groups": [ { "name": "New", "photos": ["a", "grouped"] } ] }',
      batch,
      photos,
    );
    assert.deepEqual(movingPhotos(answer.groups[0]!), [
      { name: "Title grouped", from: "Lanterns" },
    ]);
  });

  it("throws a readable error when the answer isn't the JSON asked for", () => {
    assert.throws(() => readAutogroupAnswer("no idea", batch, photos), /no JSON object/);
    assert.throws(() => readAutogroupAnswer('{ "photos": [] }', batch, photos), /"groups" list/);
  });
});
