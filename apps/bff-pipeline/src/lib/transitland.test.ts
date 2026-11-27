import assert from "node:assert/strict";
import { test } from "node:test";
import type { Spot } from "./transit-types.js";
import {
  NoTransitlandKeyError,
  TransitlandClient,
  TransitlandError,
  tlKind,
  type TlRoute,
} from "./transitland.js";

/** A Transitland client whose server answers routes(url), recording each URL and API key. */
function transitland(routes: (url: string) => TlRoute[], key = "k", status = 200) {
  const asked: string[] = [];
  const keys: string[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    asked.push(url);
    keys.push(new Headers(init.headers).get("apikey") ?? "");
    return new Response(JSON.stringify({ routes: routes(url) }), { status });
  }) as unknown as typeof globalThis.fetch;
  return { client: new TransitlandClient({ url: "http://tl", key, fetch }), asked, keys };
}

const a: Spot = [135.5023, 34.6937];

test("answers the routes near both spots, each copy of a feed once, as lines", async () => {
  const route = (id: number, onestop: string, extra: Partial<TlRoute> = {}): TlRoute => ({
    id,
    onestop_id: onestop,
    route_type: 3,
    ...extra,
  });
  const { client, asked, keys } = transitland((url) =>
    url.includes("lat=34.693700")
      ? [
          route(1, "r-a", {
            route_long_name: "Loop",
            route_color: "ff0000",
            agency: { agency_name: "City Bus" },
          }),
          route(2, "r-a"),
          route(3, "r-b"),
        ]
      : [route(1, "r-a"), route(2, "r-a")],
  );
  const lines = await client.lines("bus", a, [135.6, 34.7]);
  assert.equal(
    asked[0],
    "http://tl/routes?lat=34.693700&limit=100&lon=135.502300&radius=500&route_types=3%2C11%2C200%2C201%2C202%2C204%2C800%2C700%2C701%2C702%2C703%2C704%2C705%2C706%2C707%2C708%2C709%2C710%2C711%2C712%2C713%2C714%2C715%2C716",
  );
  assert.equal(keys[0], "k");
  assert.equal(
    JSON.stringify(lines),
    '[{"id":1,"name":"Loop","colour":"#ff0000","kind":"bus","from":"City Bus","source":"transitland"}]',
  );
});

test("follows a route's shape and orders its stops along it", async () => {
  const stop = (name: string, lon: number) => ({
    stop: { stop_name: name, geometry: { type: "Point", coordinates: [lon, 0] } },
  });
  const { client } = transitland(() => [
    {
      id: 5,
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0.01, 0],
          [0.02, 0],
        ],
      },
      route_stops: [stop("C", 0.02), stop("A", 0), stop("A", 0.001), stop("B", 0.01)],
    },
  ]);
  assert.deepEqual(await client.track(5, [0, 0.001], [0.02, 0.001]), [
    [0, 0.001],
    [0, 0],
    [0.01, 0],
    [0.02, 0],
    [0.02, 0.001],
  ]);
  assert.deepEqual(
    (await client.stops(5)).map((s) => s.name),
    ["A", "B", "C"],
  );
});

test("needs an API key, and says when Transitland doesn't answer", async () => {
  await assert.rejects(transitland(() => [], "").client.lines("bus", a, a), NoTransitlandKeyError);
  await assert.rejects(
    transitland(() => [], "k", 401).client.stops(1),
    (e: unknown) => e instanceof TransitlandError && /401 Unauthorized/.test(e.message),
  );
});

test("shows extended route types by their hundreds", () => {
  assert.equal(tlKind(2), "train");
  assert.equal(tlKind(109), "train");
  assert.equal(tlKind(704), "bus");
  assert.equal(tlKind(1200), "ferry");
  assert.equal(tlKind(50), "");
});
