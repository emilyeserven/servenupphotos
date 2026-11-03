import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";
import { decodePng, encodePng } from "./png.ts";
import { markersOf, type Pin } from "./pins.ts";
import { renderPreview, tilesFor } from "./render.ts";
import { frameOf, IMAGE } from "./view.ts";

test("covers the image with tiles, wrapping around the world sideways", () => {
  const tiles = tilesFor(frameOf({ lat: 0, lng: 180, zoom: 1 }));
  assert.deepEqual(new Set(tiles.map(({ z }) => z)), new Set([2]));
  assert.deepEqual(new Set(tiles.map(({ x }) => x)), new Set([0, 1, 2, 3]));
  assert.deepEqual(new Set(tiles.map(({ y }) => y)), new Set([1, 2]));
  const lefts = tiles.map((t) => t.left);
  assert.ok(Math.min(...lefts) <= 0 && Math.max(...lefts) + 512 >= IMAGE.width);
});

test("groups photos close together, like the map", () => {
  const frame = frameOf({ lat: 37.5665, lng: 126.978, zoom: 12 });
  const pins: Pin[] = [
    [126.978, 37.5665, null],
    [126.9781, 37.5666, null],
    [126.95, 37.56, "#ff0000"],
    [0, 0, null],
  ];
  const markers = markersOf(frame, pins);
  assert.deepEqual(markers.map((m) => m.count).toSorted(), [1, 2]);
});

/** A tile with a dark border, to see where tiles land, tinted by its position in the URL. */
async function fakeTile(url: string): Promise<Response> {
  const tint = (url.length * 37) % 50;
  const rgb = new Uint8Array(512 * 512 * 3).fill(80);
  for (let y = 2; y < 512; y++) {
    for (let x = 2; x < 512; x++) rgb.set([200 + tint, 220, 230 - tint], (y * 512 + x) * 3);
  }
  return new Response(await encodePng(rgb, 512, 512));
}

test("draws a 1200 × 630 preview with tiles, pins and the credit", async () => {
  const pins: Pin[] = [
    [126.978, 37.5665, "#514d48"],
    [126.9781, 37.5666, null],
    [126.99, 37.57, "#a2825c"],
    [126.96, 37.56, null],
  ];
  let fetched = 0;
  const started = performance.now();
  const png = await renderPreview({ lat: 37.5665, lng: 126.978, zoom: 12 }, pins, (url) => {
    fetched++;
    return fakeTile(url);
  });
  const ms = performance.now() - started;
  const image = await decodePng(png);
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.ok(fetched >= 6 && fetched <= 12);
  if (process.env.PREVIEW_OUT) {
    await writeFile(process.env.PREVIEW_OUT, png);
    console.log(`Drew in ${Math.round(ms)} ms (with fake tiles); ${png.length} bytes`);
  }
});

test("leaves a tile's square blank when it can't be fetched", async () => {
  const png = await renderPreview({ lat: 0, lng: 0, zoom: 3 }, [], () =>
    Promise.resolve(new Response("", { status: 503 })),
  );
  const image = await decodePng(png);
  assert.deepEqual([...image.data.subarray(0, 3)], [250, 250, 248]);
});
