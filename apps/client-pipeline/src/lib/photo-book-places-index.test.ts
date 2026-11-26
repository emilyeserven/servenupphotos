import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "@/api/places";
import type { CaptionLists } from "@/lib/caption-template";
import { type IndexEntry, entryCount, placesIndex } from "@/lib/photo-book-places-index";

const place = (id: string, name: string, parent?: string): Place => ({
  id,
  name,
  description: "",
  parent,
});

const lists: CaptionLists = {
  places: [
    place("palace", "Gyeongbokgung"),
    place("gate", "Geunjeongmun Gate", "palace"),
    place("seoul-place", "Seoul"),
    place("bridge", "Golden Gate Bridge"),
  ],
  localizations: [
    {
      id: "place-palace",
      type: "place",
      name: "Gyeongbokgung",
      romanization: "Gyeongbokgung",
      pronunciation: "",
      localScript: "경복궁",
    },
    {
      id: "city-seoul",
      type: "city",
      name: "Seoul",
      romanization: "Seoul",
      pronunciation: "",
      localScript: "서울",
    },
  ],
  names: { albums: new Map(), tags: new Map(), genres: new Map() },
};

const seoulGate = {
  country: "South Korea",
  state: "Seoul",
  city: "Seoul",
  places: [
    { relation: "", id: "gate" },
    { relation: "in", id: "seoul-place" },
  ],
};
const bridge = {
  country: "United States",
  state: "California",
  customCity: "San Francisco",
  city: "Sausalito",
  places: [{ relation: "", id: "bridge" }],
};
const busan = { country: "South Korea", city: "Busan", placeName: "Haeundae Beach" };

/** The entries as indented lines, to compare whole trees at a glance. */
function lines(entries: IndexEntry[], depth = 0): string[] {
  return entries.flatMap((e) => [
    `${"  ".repeat(depth)}${e.name}`,
    ...lines(e.children, depth + 1),
  ]);
}

test("a Places Index lists every place under the places it's in, alphabetically", () => {
  const index = placesIndex([seoulGate, bridge, busan], lists, { kind: "places-index" });
  assert.deepEqual(lines(index), [
    "South Korea",
    "  Busan",
    "    Haeundae Beach",
    "  Seoul",
    "    Gyeongbokgung",
    "      Geunjeongmun Gate",
    "United States",
    "  California",
    "    San Francisco",
    "      Golden Gate Bridge",
  ]);
  assert.equal(entryCount(index), 10);
  assert.equal(index[0]?.key, "country:South Korea");
  assert.equal(index[0]?.children[0]?.children[0]?.key, "placeName:Haeundae Beach");
});

test("a Places Index can follow the book's order and stop at a level", () => {
  const index = placesIndex([seoulGate, bridge, busan], lists, {
    kind: "places-index",
    order: "book",
    depth: "city",
  });
  assert.deepEqual(lines(index), [
    "South Korea",
    "  Seoul",
    "  Busan",
    "United States",
    "  California",
    "    San Francisco",
  ]);
});

test("a hidden entry's places move up into the entry above it", () => {
  const index = placesIndex([seoulGate, bridge], lists, {
    kind: "places-index",
    hidden: ["state:California", "place:palace", "country:South Korea"],
  });
  assert.deepEqual(lines(index), [
    "Seoul",
    "  Geunjeongmun Gate",
    "United States",
    "  San Francisco",
    "    Golden Gate Bridge",
  ]);
});

test("a Places Index writes names localized and US states abbreviated when it says to", () => {
  const index = placesIndex([seoulGate, bridge], lists, {
    kind: "places-index",
    localized: true,
    stateAbbreviations: true,
  });
  assert.deepEqual(lines(index), [
    "South Korea",
    "  서울 (Seoul)",
    "    경복궁 (Gyeongbokgung)",
    "      Geunjeongmun Gate",
    "United States",
    "  CA",
    "    San Francisco",
    "      Golden Gate Bridge",
  ]);
});

test("photos without a location add nothing", () => {
  assert.deepEqual(placesIndex([{}, { places: [] }], lists, { kind: "places-index" }), []);
});
