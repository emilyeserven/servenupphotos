import assert from "node:assert/strict";
import { test } from "node:test";
import { AreaFinder, NoRelationError, serverUrl } from "./area-finder.js";
import { Gate } from "./gate.js";

const park = [
  {
    name: "Osaka Castle Park",
    display_name: "Osaka Castle Park, Chuo, Osaka",
    type: "park",
    addresstype: "park",
    osm_type: "relation",
    osm_id: 358674,
    geojson: {
      type: "Polygon",
      coordinates: [
        [
          [135.52, 34.68],
          [135.53, 34.68],
          [135.53, 34.69],
          [135.52, 34.68],
        ],
      ],
    },
  },
];

/** A finder whose servers answer with answer(address), recording each address asked and its user agent. */
function finderAnswering(answer: (address: string) => unknown, init: { status?: number } = {}) {
  const asked: string[] = [];
  const agents: string[] = [];
  const fakeFetch = (async (input: string | URL | Request, options?: RequestInit) => {
    const address = String(input);
    asked.push(address);
    agents.push(new Headers(options?.headers).get("user-agent") ?? "");
    return new Response(JSON.stringify(answer(address)), {
      status: init.status ?? 200,
      statusText: "Nope",
    });
  }) as typeof fetch;
  const finder = new AreaFinder({
    nominatimUrl: "http://osm",
    wikidataUrl: "http://wd",
    gate: new Gate(0),
    fetch: fakeFetch,
  });
  return { finder, asked, agents };
}

test("finds areas by name with one Nominatim search, naming the pipeline", async () => {
  const { finder, asked, agents } = finderAnswering(() => park);
  const found = await finder.find(" Osaka Castle Park ");
  assert.deepEqual(asked, [
    "http://osm/search?format=jsonv2&limit=8&polygon_geojson=1&polygon_threshold=0.0005&q=Osaka+Castle+Park",
  ]);
  assert.match(agents[0]!, /^servenupphotos-pipeline/);
  assert.equal(found[0]?.osm, "R358674");
});

test("finds a Wikidata item's area through its OpenStreetMap relation", async () => {
  const { finder, asked } = finderAnswering((address) =>
    address.startsWith("http://wd")
      ? {
          entities: {
            Q1: { claims: { P402: [{ mainsnak: { datavalue: { value: "358674" } } }] } },
          },
        }
      : park,
  );
  const found = await finder.find("Q1");
  assert.equal(asked[0], "http://wd/wiki/Special:EntityData/Q1.json");
  assert.match(asked[1]!, /^http:\/\/osm\/lookup\?.*osm_ids=R358674/);
  assert.equal(found.length, 1);
});

test("rejects a Wikidata item without a relation", async () => {
  const { finder } = finderAnswering(() => ({ entities: { Q2: { claims: {} } } }));
  await assert.rejects(finder.find("Q2"), NoRelationError);
});

test("keeps answers, so the same search asks once", async () => {
  const { finder, asked } = finderAnswering(() => park);
  await finder.find("Osaka Castle Park");
  await finder.find("Osaka Castle Park");
  assert.equal(asked.length, 1);
});

test("says what the server answered when it isn't OK", async () => {
  const { finder } = finderAnswering(() => ({}), { status: 503 });
  await assert.rejects(finder.find("Osaka"), /the server answered 503 Nope/);
});

test("reads a server address without its trailing slash, or else the default", () => {
  assert.equal(serverUrl("http://local/", "http://default"), "http://local");
  assert.equal(serverUrl("", "http://default"), "http://default");
  assert.equal(serverUrl(undefined, "http://default"), "http://default");
});
