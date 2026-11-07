import assert from "node:assert/strict";
import { test } from "node:test";
import { decodePng, encodePng } from "./png.ts";

/** Bytes from base64. */
function bytes(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

test("reads a 2-bit palette PNG, like many map tiles", async () => {
  const image = await decodePng(
    bytes(
      "iVBORw0KGgoAAAANSUhEUgAAAAUAAAADAgMAAAAmWC1rAAAADFBMVEX/AAAA/wAAAP/6+vge2MP7AAAAEUlEQVR4nGOQZmAJvMLiKgIABogBoqvmt1sAAAAASUVORK5CYII=",
    ),
  );
  assert.equal(image.width, 5);
  assert.equal(image.height, 3);
  // The second row starts with palette entry 1 (green), then 2 (blue).
  assert.deepEqual([...image.data.subarray(20, 28)], [0, 255, 0, 255, 0, 0, 255, 255]);
  // The last pixel is palette entry 2 (blue).
  assert.deepEqual([...image.data.subarray(56, 60)], [0, 0, 255, 255]);
});

test("reads an RGBA PNG", async () => {
  const image = await decodePng(
    bytes(
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAG0lEQVR4nGPkEpH7Lycn1ygnJ9fAyMjEzAIDADllAx0SsrkWAAAAAElFTkSuQmCC",
    ),
  );
  assert.deepEqual(
    [...image.data],
    [10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
});

test("reads a gray PNG", async () => {
  const image = await decodePng(
    bytes(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAADklEQVR4nGNgCGVY9R8AA60B/2f7ygkAAAAASUVORK5CYII=",
    ),
  );
  assert.deepEqual([...image.data.subarray(4, 8)], [85, 85, 85, 255]);
});

test("writes a PNG it can read back", async () => {
  const rgb = Uint8Array.from({ length: 4 * 3 * 3 }, (_, i) => (i * 37) % 256);
  const image = await decodePng(await encodePng(rgb, 4, 3));
  assert.equal(image.width, 4);
  const back = [...image.data].filter((_, i) => i % 4 !== 3);
  assert.deepEqual(back, [...rgb]);
});
