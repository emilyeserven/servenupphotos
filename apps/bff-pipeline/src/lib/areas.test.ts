import assert from "node:assert/strict";
import { test } from "node:test";
import { areasOf, isWikidataId, MAX_POINTS, pointCount, relationOf, shapeOf } from "./areas.js";

const ring: [number, number][] = [
  [135.52, 34.68],
  [135.53, 34.68],
  [135.53, 34.69],
  [135.52, 34.68],
];

test("keeps places with an outline, as areas", () => {
  const found = areasOf([
    {
      name: "Osaka Castle Park",
      display_name: "Osaka Castle Park, Chuo, Osaka",
      type: "park",
      addresstype: "park",
      osm_type: "relation",
      osm_id: 358674,
      geojson: { type: "Polygon", coordinates: [ring] },
    },
    {
      name: "Osaka Castle",
      osm_type: "node",
      osm_id: 1,
      geojson: { type: "Point", coordinates: [1, 2] },
    },
  ]);
  assert.deepEqual(found, [
    {
      name: "Osaka Castle Park",
      place: "Osaka Castle Park, Chuo, Osaka",
      kind: "park",
      osm: "R358674",
      shape: [[ring]],
    },
  ]);
});

test("names a place without a name by the first part of where it is, and its kind by its type", () => {
  const [area] = areasOf([
    {
      display_name: " Chuo , Osaka",
      type: "suburb",
      osm_type: "way",
      osm_id: 7,
      geojson: { type: "MultiPolygon", coordinates: [[ring], [ring]] },
    },
  ]);
  assert.equal(area?.name, "Chuo");
  assert.equal(area?.kind, "suburb");
  assert.equal(area?.osm, "W7");
  assert.equal(pointCount(area!.shape), 8);
});

test("keeps at most eight areas", () => {
  const place = { geojson: { type: "Polygon", coordinates: [ring] } };
  assert.equal(areasOf(Array.from({ length: 10 }, () => place)).length, 8);
});

test("leaves out an outline over MAX_POINTS, an empty one, or one that isn't numbers", () => {
  const big = Array.from({ length: MAX_POINTS + 1 }, () => [1, 2]);
  assert.equal(shapeOf({ type: "Polygon", coordinates: [big] }), undefined);
  assert.equal(shapeOf({ type: "Polygon", coordinates: [] }), undefined);
  assert.equal(shapeOf({ type: "Polygon", coordinates: [[["a", 2]]] }), undefined);
  assert.equal(shapeOf(undefined), undefined);
});

test("tells Wikidata IDs from names", () => {
  assert.ok(isWikidataId("Q1490"));
  assert.ok(!isWikidataId("Q0"));
  assert.ok(!isWikidataId("q1490"));
  assert.ok(!isWikidataId("Queens"));
});

test("reads an item's first OpenStreetMap relation", () => {
  const claim = (value: unknown) => ({ mainsnak: { datavalue: { value } } });
  const data = { entities: { Q1: { claims: { P402: [claim(5), claim(""), claim("358674")] } } } };
  assert.equal(relationOf(data, "Q1"), "358674");
  assert.equal(relationOf({ entities: { Q2: { claims: {} } } }, "Q2"), "");
});
