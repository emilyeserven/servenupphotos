import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNREADABLE_ANSWER,
  canReview,
  matchName,
  nameFinder,
  parsePastedJson,
  readPastedList,
  readPastedObject,
  settleAnswer,
} from "@/lib/pasted-json";

test("reads straight JSON as it is", () => {
  assert.deepEqual(parsePastedJson('{"city": "Cheongju", "exact": false}'), {
    city: "Cheongju",
    exact: false,
  });
});

test("reads JSON whose double quotes are curly, keeping curly single quotes", () => {
  const pasted =
    "{“city”: “Cheongju”, “exact”: false, “reasoning”: “after the shot ‘Train to Busan II’”}";
  assert.deepEqual(parsePastedJson(pasted), {
    city: "Cheongju",
    exact: false,
    reasoning: "after the shot ‘Train to Busan II’",
  });
});

test("keeps curly double quotes inside values when the JSON reads without changing them", () => {
  assert.deepEqual(parsePastedJson('{"reasoning": "near “Osong”"}'), { reasoning: "near “Osong”" });
});

test("throws the error from the text as pasted when it isn't JSON either way", () => {
  assert.throws(() => parsePastedJson("{“city”: Cheongju}"), SyntaxError);
});

test("reads the object inside a code block with curly quotes", () => {
  const answer = readPastedObject("```json\n{“city”: “Cheongju”, “latitude”: 36.6203}\n```");
  assert.deepEqual(answer, { city: "Cheongju", latitude: 36.6203 });
});

test("says the same sentence when there's no object, or it can't be read", () => {
  for (const text of ["No JSON here.", "{“city”: Cheongju}", "[1, 2]", "} then {"]) {
    assert.throws(() => readPastedObject(text), { message: UNREADABLE_ANSWER });
  }
});

test("names the list an answer is missing", () => {
  assert.deepEqual(readPastedList('Here: {"photos": [1]}', "photos"), [1]);
  assert.throws(() => readPastedList('{"groups": []}', "photos"), {
    message: 'The answer\'s JSON has no "photos" list.',
  });
});

test("matches a name however the answer wrote it", () => {
  for (const name of ["img_1", " IMG_1 ", "IMG_1.JSON", '"img_1.json"', "“IMG_1”", "'img_1'"]) {
    assert.equal(matchName(name), "img_1");
  }
});

test("finds things by any of their names, the first one winning", () => {
  const find = nameFinder(
    [
      { key: "a", file: "DSCF1.JPG" },
      { key: "b", file: "a" },
    ],
    (item) => [item.key, item.file],
  );
  assert.equal(find("A.json")?.key, "a");
  assert.equal(find("dscf1.jpg")?.key, "a");
  assert.equal(find("zzz"), undefined);
});

test("settles on the answer, or on the error from reading it in the browser or the backend", async () => {
  assert.deepEqual(await settleAnswer((typed) => typed.length, "abc"), { answer: 3, error: null });
  const sync = await settleAnswer(() => readPastedObject("no JSON"), "");
  assert.equal(sync.error?.message, UNREADABLE_ANSWER);
  const backend = await settleAnswer(() => Promise.reject(new Error("GitHub said no.")), "");
  assert.equal(backend.error?.message, "GitHub said no.");
});

test("reviews only a box with text and nothing waiting", () => {
  assert.equal(canReview("  ", false), false);
  assert.equal(canReview("{}", true), false);
  assert.equal(canReview("{}", false), true);
});
