import assert from "node:assert/strict";
import { test } from "node:test";
import { PhotonError, photonQuery, photonStationSearch, placeName } from "./photon.js";
import { NoKindError, NoNameError, type Spot } from "./transit-types.js";

const near: Spot = [135.5023, 34.6937];

/** Photon options whose server answers features(query) for each search, recording each query. */
function photon(features: (url: string) => unknown[], status = 200) {
  const asked: string[] = [];
  const fetch = (async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify({ features: features(url) }), { status });
  }) as unknown as typeof globalThis.fetch;
  return { options: { url: "http://photon/api/", fetch }, asked };
}

test("writes the search as the Go backend did", () => {
  assert.equal(
    photonQuery(["railway:station", "railway:halt"], "Shin Ōsaka", near),
    "bbox=134.502300%2C33.693700%2C136.502300%2C35.693700&lang=en&lat=34.693700&limit=30&lon=135.502300&osm_tag=railway%3Astation&osm_tag=railway%3Ahalt&q=Shin+%C5%8Csaka",
  );
});

test("drops words like Station from a name", () => {
  assert.equal(placeName("Shimonoseki Station."), "Shimonoseki");
  assert.equal(placeName("Station"), "Station");
});

test("answers stations in Photon's order, each name once, searching again without Station when nothing's found", async () => {
  const feature = (name: string, lon: number) => ({
    geometry: { coordinates: [lon, 34.6937] },
    properties: { name },
  });
  const { options, asked } = photon((url) =>
    url.includes("Station")
      ? []
      : [feature("Namba", 135.5), feature("Namba", 135.6), feature("", 1)],
  );
  const found = await photonStationSearch(options, "train", " Namba Station ", near);
  assert.equal(asked.length, 2);
  assert.deepEqual(found, [{ name: "Namba", latitude: 34.6937, longitude: 135.5, km: 0.2 }]);
});

test("says why a search can't be run, or that Photon didn't answer", async () => {
  const { options } = photon(() => [], 503);
  await assert.rejects(photonStationSearch(options, "walk", "x", near), NoKindError);
  await assert.rejects(photonStationSearch(options, "bus", " ", near), NoNameError);
  await assert.rejects(
    photonStationSearch(options, "bus", "x", near),
    (e: unknown) => e instanceof PhotonError && /answered 503 Service Unavailable/.test(e.message),
  );
});
