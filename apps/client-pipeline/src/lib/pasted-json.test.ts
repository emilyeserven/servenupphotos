import assert from "node:assert/strict";
import { test } from "node:test";

import { jsonObject } from "@/lib/location-prompt";
import { parsePastedJson } from "@/lib/pasted-json";

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

test("the location answer box reads a curly-quoted answer", () => {
  const answer = jsonObject("```json\n{“city”: “Cheongju”, “latitude”: 36.6203}\n```");
  assert.deepEqual(answer, { city: "Cheongju", latitude: 36.6203 });
});
