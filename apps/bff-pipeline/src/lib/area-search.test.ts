import assert from "node:assert/strict";
import { test } from "node:test";
import { NoRelationError } from "./area-finder.js";
import { answerAreaSearch, searchOf } from "./area-search.js";

const area = {
  name: "Osaka Castle Park",
  place: "",
  kind: "park",
  osm: "R1",
  shape: [[[[1, 2] as [number, number]]]],
};

test("answers the areas found", async () => {
  const answer = await answerAreaSearch(async () => [area], "Osaka Castle Park");
  assert.deepEqual(answer, { status: 200, body: [area] });
});

test("asks for a search when there's none or it's too long", async () => {
  for (const q of ["", "x".repeat(201), "あ".repeat(67)]) {
    assert.equal((await answerAreaSearch(async () => [area], q)).status, 400, q);
  }
});

test("a Wikidata item without a relation is a 404, and a server failure a 502", async () => {
  const none = await answerAreaSearch(async () => Promise.reject(new NoRelationError()), "Q2");
  assert.equal(none.status, 404);
  const failed = await answerAreaSearch(
    async () => Promise.reject(new Error("the server answered 503")),
    "Osaka",
  );
  assert.deepEqual(failed, {
    status: 502,
    body: { message: "Couldn't look up the area on OpenStreetMap: the server answered 503" },
  });
});

test("reads the first q, trimmed", () => {
  assert.equal(searchOf({ q: " Osaka " }), "Osaka");
  assert.equal(searchOf({ q: ["Kyoto", "Nara"] }), "Kyoto");
  assert.equal(searchOf({}), "");
  assert.equal(searchOf(undefined), "");
});
