import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autogroupAsk } from "@/lib/compare-autogroup";
import { movingPhotos, readAutogroupAnswer } from "@/lib/compare-autogroup-answer";
import type { ComparePhoto } from "@/lib/compare-groups";

const photo = (name: string, data: Record<string, unknown> = {}): ComparePhoto => ({
  file: { path: `photos/${name}.json`, status: "modified", fileUrl: "", photoName: `${name}.jpg` },
  data: { title: `Title ${name}`, images: { small: `https://cdn/${name}-small.webp` }, ...data },
  fromGallery: false,
});

const photos = [
  photo("a"),
  photo("b"),
  photo("c"),
  photo("l1", { compareGroup: "Lanterns" }),
  photo("l2", { compareGroup: "Lanterns" }),
  photo("h1", { compareGroup: "Harbor" }),
  photo("h2", { compareGroup: "Harbor" }),
  photo("d1", { compareGroup: "Doors" }),
  photo("d2", { compareGroup: "Doors" }),
];
const ask = autogroupAsk(photos, { scope: "all", withGroups: true });
const read = (answer: unknown) => readAutogroupAnswer(JSON.stringify(answer), ask, photos);
const keys = (list: { key: string }[]) => list.map((entry) => entry.key);

describe("readAutogroupAnswer", () => {
  it("reads new groups from JSON in a code fence, looking photos up by name", () => {
    const answer = readAutogroupAnswer(
      '```json\n{ "groups": [ { "name": "Morning", "photos": ["a", "B.json", "c", "nope"] } ] }\n```',
      ask,
      photos,
    );
    assert.deepEqual(
      answer.groups.map((group) => [group.name, keys(group.photos), group.existing]),
      [["Morning", ["a", "b", "c"], false]],
    );
    assert.deepEqual(answer.unknown, ["nope"]);
  });

  it("keeps a photo in its first group and drops groups left with one photo", () => {
    const answer = read({
      groups: [
        { name: "One", photos: ["a", "b"] },
        { name: "Two", photos: ["b", "c"] },
      ],
    });
    assert.deepEqual(
      answer.groups.map((group) => group.name),
      ["One"],
    );
  });

  it("adds one photo to a group there is, keeping its saved name", () => {
    const answer = read({ groups: [{ name: "lanterns", photos: ["a"] }] });
    assert.deepEqual(
      answer.groups.map((group) => [group.name, group.existing]),
      [["Lanterns", true]],
    );
  });

  it("says which photos move out of another group", () => {
    const answer = read({ groups: [{ name: "New", photos: ["a", "l1"] }] });
    assert.deepEqual(movingPhotos(answer.groups[0]!), [{ name: "Title l1", from: "Lanterns" }]);
  });

  it("reads groups to combine, naming unknown groups", () => {
    const answer = read({
      merge: [
        { groups: ["Lanterns", "Harbor", "Nowhere"], name: "Evening" },
        { groups: ["Harbor", "Doors"] },
      ],
    });
    assert.deepEqual(
      answer.merges.map((merge) => [merge.name, merge.groups.map((group) => group.name)]),
      [["Evening", ["Lanterns", "Harbor"]]],
    );
    assert.deepEqual(answer.unknownGroups, ["Nowhere"]);
  });

  it("reads groups to remove, leaving out ones being combined", () => {
    const answer = read({
      merge: [{ groups: ["Lanterns", "Harbor"], name: "Harbor" }],
      remove: [
        { group: "Doors", reason: "Different streets." },
        { group: "Harbor", reason: "" },
      ],
    });
    assert.deepEqual(
      answer.removals.map((removal) => [removal.group.name, removal.reason]),
      [["Doors", "Different streets."]],
    );
  });

  it("throws a readable error when the answer isn't the JSON asked for", () => {
    assert.throws(() => readAutogroupAnswer("no idea", ask, photos), /no JSON object/);
    assert.throws(() => read({ photos: [] }), /no "groups", "merge" or "remove" list/);
  });
});
