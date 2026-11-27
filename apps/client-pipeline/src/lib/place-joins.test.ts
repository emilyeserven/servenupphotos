import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "@/api/places";
import {
  JOIN_WORDS,
  needsSecondPlace,
  placePhrase,
  rowJoin,
  withBetweenJoin,
} from "@/lib/place-joins";

const place = (id: string, name: string, parent = ""): Place =>
  ({ id, name, parent, description: "", city: "", country: "" }) as Place;

const places = [place("kiyo", "Kiyo"), place("uta", "Uta", "kiyo"), place("gate", "Gate", "kiyo")];
const names = new Map(places.map((p) => [p.id, p.name]));

test("a photo between two places reads “Between Kiyo and Uta”", () => {
  const rows = [
    { relation: "between", id: "kiyo" },
    { relation: "by", id: "uta" },
  ];
  assert.equal(placePhrase(rows, [], names), "Between Kiyo and Uta");
  assert.equal(rowJoin(rows, 1, []), "and");
  assert.equal(rowJoin(rows, 0, []), undefined);
});

test("“and” after “between” wins over the word from the places", () => {
  const rows = [
    { relation: "between", id: "gate" },
    { relation: "", id: "kiyo" },
  ];
  assert.equal(rowJoin(rows, 1, places), "and");
  assert.equal(placePhrase(rows, places, names), "Between Gate and Kiyo");
  assert.equal(rowJoin([{ relation: "by", id: "gate" }, rows[1]!], 1, places), "in");
});

test("the place after “between” is saved with “and”, and others are left as they are", () => {
  const rows = [
    { relation: "between", id: "kiyo" },
    { relation: "by", id: "uta" },
  ];
  assert.deepEqual(withBetweenJoin(rows), [rows[0], { relation: "and", id: "uta" }]);
  const near = [{ relation: "near", id: "kiyo" }, rows[1]!];
  assert.deepEqual(withBetweenJoin(near), near);
});

test("a place can't be joined to the place it's in with “between” or “and”", () => {
  assert.ok(!JOIN_WORDS.includes("between"));
  assert.ok(!JOIN_WORDS.includes("and"));
  assert.ok(JOIN_WORDS.includes(","));
});

test("a photo “between” one place still needs its second", () => {
  assert.ok(needsSecondPlace([{ relation: "between", id: "kiyo" }]));
  assert.ok(
    needsSecondPlace([
      { relation: "between", id: "kiyo" },
      { relation: "and", id: "" },
    ]),
  );
  assert.ok(
    !needsSecondPlace([
      { relation: "between", id: "kiyo" },
      { relation: "and", id: "uta" },
    ]),
  );
  assert.ok(!needsSecondPlace([{ relation: "near", id: "kiyo" }]));
});
