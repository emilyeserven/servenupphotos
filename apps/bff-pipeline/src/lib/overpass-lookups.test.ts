import assert from "node:assert/strict";
import { test } from "node:test";
import { Gate } from "./gate.js";
import {
  bestStations,
  linesQuery,
  overpassLines,
  overpassStops,
  overpassTrack,
  stationsQuery,
} from "./overpass-lookups.js";
import { OverpassClient } from "./overpass.js";
import { NoKindError, NoTrackError, type Spot } from "./transit-types.js";

const a: Spot = [135.5023, 34.6937];
const b: Spot = [-0.125, 51.5];

/** An Overpass client whose one server answers elements for every query, recording each query. */
function answering(elements: unknown[]) {
  const asked: string[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    asked.push(new URLSearchParams(String(init.body)).get("data") ?? "");
    return new Response(JSON.stringify({ elements }));
  }) as unknown as typeof globalThis.fetch;
  return {
    client: new OverpassClient({ urls: ["http://overpass"], gate: new Gate(0), fetch }),
    asked,
  };
}

test("writes the lines query as the Go backend did", () => {
  assert.equal(
    linesQuery("bus", a, b),
    '[out:json][timeout:20];\n(way(around:500,34.693700,135.502300)[highway];)->.w1;\nrel(bw.w1)[type=route][route~"^(bus|trolleybus|coach)$"]->.a;\nway(r.a)(around:500,51.500000,-0.125000);\nrel(bw)->.b;\nrel.a.b;\nout tags;',
  );
});

test("writes the stations queries as the Go backend did, bus stops matched by name", () => {
  assert.equal(
    stationsQuery("bus", 'a.b"c\\d', a),
    '[out:json][timeout:20];(nwr[highway=bus_stop](around:30000,34.69,135.50);nwr[amenity=bus_station](around:30000,34.69,135.50);nwr[public_transport=station][bus=yes](around:30000,34.69,135.50);)->.s;nwr.s[~"^((official|alt|short|old)_)?name(:[A-Za-z_-]+)?$"~"a\\\\.b\\"c\\\\\\\\d",i];out tags center 3000;',
  );
  assert.equal(
    stationsQuery("train", "x", b),
    '[out:json][timeout:20];(nwr[railway~"^(station|halt)$"][station!~"^(subway|light_rail|monorail)$"](around:30000,51.50,-0.12);nwr[public_transport=station][train=yes](around:30000,51.50,-0.12);)->.s;nwr.s;out tags center 3000;',
  );
});

test("answers lines sorted by number then name, leaving out empty fields", async () => {
  const { client } = answering([
    {
      type: "relation",
      id: 2,
      tags: { route: "subway", name: "Midosuji", ref: "M", colour: "#e5171f" },
    },
    { type: "relation", id: 1, tags: { route: "subway", "name:en": "Chuo" } },
    { type: "relation", id: 3, tags: { route: "subway" } },
  ]);
  const lines = await overpassLines(client, "subway", a, a);
  assert.deepEqual(JSON.parse(JSON.stringify(lines)), [
    { id: 1, name: "Chuo", kind: "subway" },
    { id: 3, name: "Line 3", kind: "subway" },
    { id: 2, name: "Midosuji", ref: "M", colour: "#e5171f", kind: "subway" },
  ]);
  assert.equal(JSON.stringify(lines[0]), '{"id":1,"name":"Chuo","kind":"subway"}');
  await assert.rejects(overpassLines(client, "walk", a, a), NoKindError);
});

test("follows a line's track between the points nearest the spots, leaving out platforms", async () => {
  const way = (role: string, points: Spot[]) => ({
    type: "way",
    ref: 1,
    role,
    geometry: points.map(([lon, lat]) => ({ lat, lon })),
  });
  const { client } = answering([
    {
      type: "relation",
      id: 9,
      members: [
        way("", [
          [0, 0],
          [0.01, 0],
        ]),
        way("", [
          [0.01, 0],
          [0.02, 0],
        ]),
        way("platform", [
          [5, 5],
          [6, 6],
        ]),
      ],
    },
  ]);
  const track = await overpassTrack(client, 9, [0, 0.001], [0.02, 0.001]);
  assert.deepEqual(track, [
    [0, 0.001],
    [0, 0],
    [0.01, 0],
    [0.02, 0],
    [0.02, 0.001],
  ]);
});

test("a track that doesn't join the spots fails", async () => {
  const way = (points: Spot[]) => ({
    type: "way",
    ref: 1,
    role: "",
    geometry: points.map(([lon, lat]) => ({ lat, lon })),
  });
  const { client } = answering([
    {
      type: "relation",
      id: 9,
      members: [
        way([
          [0, 0],
          [0.01, 0],
        ]),
        way([
          [1, 1],
          [1.01, 1],
        ]),
      ],
    },
  ]);
  await assert.rejects(overpassTrack(client, 9, [0, 0], [1.01, 1]), NoTrackError);
});

test("answers a line's stops in order, each name once, or its platforms when it marks none", async () => {
  const node = (id: number, name?: string) => ({
    type: "node",
    id,
    lat: id,
    lon: id,
    tags: name ? { name } : {},
  });
  const member = (ref: number, role: string) => ({ type: "node", ref, role });
  const { client } = answering([
    {
      type: "relation",
      id: 7,
      members: [
        member(1, "stop"),
        member(2, "stop_entry_only"),
        member(3, "stop"),
        member(4, "platform"),
      ],
    },
    node(1, "Namba"),
    node(2, "Namba"),
    node(3),
    node(4, "Platform"),
  ]);
  assert.deepEqual(await overpassStops(client, 7), [
    { name: "Namba", latitude: 1, longitude: 1 },
    { name: "Stop 2", latitude: 3, longitude: 3 },
  ]);
});

test("ranks stations by the words they have, then the nearest, each name once", () => {
  const station = (name: string, lon: number, tags: Record<string, string> = {}) => ({
    type: "node",
    id: 1,
    lat: 0,
    lon,
    tags: { name, ...tags },
  });
  const found = bestStations(
    [
      station("下関", 2, { "name:en": "Shimonoseki" }),
      station("Shimonoseki Port Terminal", 1),
      station("Shimonoseki Port Terminal", 0.5),
      station("Other", 0),
    ],
    ["shimonoseki", "port"],
    [0, 0],
  );
  assert.deepEqual(
    found.map((s) => [s.name, s.nameEn, s.km]),
    [
      ["Shimonoseki Port Terminal", undefined, 55.6],
      ["下関", "Shimonoseki", 222.4],
    ],
  );
});
