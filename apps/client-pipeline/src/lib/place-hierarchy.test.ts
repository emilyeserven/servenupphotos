import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "@/api/places";
import {
  ancestors,
  isLocalized,
  isUnitedStates,
  notParentsOf,
  placeCity,
  specificFirst,
  unrelatedPair,
  withParent,
} from "@/lib/place-hierarchy";

/** A place with only the fields these tests read. */
function place(id: string, fields: Partial<Place> = {}): Place {
  return { id, name: id, description: "", ...fields };
}

const palace = place("palace", { city: "Seoul", country: "South Korea" });
const gate = place("gate", { parent: "palace" });
const hall = place("hall", { parent: "gate" });
const park = place("park", { city: " Tokyo ", country: "Japan" });
const places = [palace, gate, hall, park];

test("a place's ancestors go nearest first and stop at a loop", () => {
  assert.deepEqual(ancestors(places, "hall"), [gate, palace]);
  assert.deepEqual(ancestors(places, "park"), []);
  const loop = [place("a", { parent: "b" }), place("b", { parent: "a" })];
  assert.deepEqual(
    ancestors(loop, "a").map((p) => p.id),
    ["b", "a"],
  );
  assert.deepEqual([...notParentsOf(places, "palace")].toSorted(), ["gate", "hall", "palace"]);
});

test("choosing the only place adds its parent as the second place, in an empty row or a new one", () => {
  assert.deepEqual(withParent([{ relation: "in", id: "gate" }], 0, places), [
    { relation: "in", id: "gate" },
    { relation: "in", id: "palace" },
  ]);
  assert.deepEqual(
    withParent(
      [
        { relation: "at", id: "gate" },
        { relation: "", id: "" },
      ],
      0,
      places,
    ),
    [
      { relation: "at", id: "gate" },
      { relation: "in", id: "palace" },
    ],
  );
  assert.deepEqual(
    withParent(
      [
        { relation: "near", id: "" },
        { relation: "at", id: "gate" },
      ],
      1,
      places,
    ),
    [
      { relation: "near", id: "palace" },
      { relation: "at", id: "gate" },
    ],
  );
});

test("no parent is added for a place without one, or when two places are chosen", () => {
  const alone = [{ relation: "in", id: "park" }];
  assert.equal(withParent(alone, 0, places), alone);
  const two = [
    { relation: "in", id: "gate" },
    { relation: "in", id: "park" },
  ];
  assert.equal(withParent(two, 0, places), two);
});

test("the more specific place goes first, each relation staying in its row", () => {
  assert.deepEqual(
    specificFirst(
      [
        { relation: "in", id: "palace" },
        { relation: "at", id: "hall" },
      ],
      places,
    ),
    [
      { relation: "in", id: "hall" },
      { relation: "at", id: "palace" },
    ],
  );
  const right = [
    { relation: "in", id: "hall" },
    { relation: "at", id: "palace" },
  ];
  assert.equal(specificFirst(right, places), right);
});

test("two places neither of which is in the other are offered as a pair when the first has no parent", () => {
  const rows = [
    { relation: "in", id: "park" },
    { relation: "in", id: "palace" },
  ];
  assert.deepEqual(unrelatedPair(rows, places), { child: park, parent: palace });
  // The first already has a parent, the second is in the first, or only one place is chosen.
  assert.equal(
    unrelatedPair(
      [
        { relation: "in", id: "gate" },
        { relation: "in", id: "park" },
      ],
      places,
    ),
    undefined,
  );
  assert.equal(
    unrelatedPair(
      [
        { relation: "in", id: "palace" },
        { relation: "in", id: "hall" },
      ],
      places,
    ),
    undefined,
  );
  assert.equal(
    unrelatedPair(
      [
        { relation: "in", id: "park" },
        { relation: "in", id: "park" },
      ],
      places,
    ),
    undefined,
  );
  assert.equal(unrelatedPair([{ relation: "in", id: "park" }], places), undefined);
});

test("a photo's city comes from the least specific place, the places it's in, then the rest", () => {
  const seoul = { city: "Seoul", country: "South Korea" };
  assert.deepEqual(placeCity([{ relation: "in", id: "hall" }], places), seoul);
  assert.deepEqual(
    placeCity(
      [
        { relation: "in", id: "hall" },
        { relation: "in", id: "gate" },
      ],
      places,
    ),
    seoul,
  );
  assert.deepEqual(placeCity([{ relation: "in", id: "park" }], places), {
    city: "Tokyo",
    country: "Japan",
  });
  assert.deepEqual(placeCity([{ relation: "in", id: "x" }], [place("x", { country: "Peru" })]), {
    city: "",
    country: "Peru",
  });
  assert.equal(placeCity([{ relation: "in", id: "x" }], [place("x")]), undefined);
  assert.equal(placeCity([], places), undefined);
});

test("the United States goes by several names, and an empty country isn't it", () => {
  assert.equal(isUnitedStates(" USA "), true);
  assert.equal(isUnitedStates("United States of America"), true);
  assert.equal(isUnitedStates(""), false);
  assert.equal(isUnitedStates("Canada"), false);
});

test("a place is localized when its saved localization has anything written", () => {
  const written = { id: "place-palace", romanization: "Gyeongbokgung" };
  const empty = { id: "place-palace", romanization: "", pronunciation: "", localScript: "" };
  assert.equal(isLocalized(palace, [written] as never), true);
  assert.equal(isLocalized(palace, [empty] as never), false);
  assert.equal(isLocalized(park, [written] as never), false);
});
