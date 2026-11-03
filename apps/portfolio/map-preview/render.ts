/**
 * Draws a map preview image: CARTO's map tiles for the view, the photo pins over them, and the map
 * credit in the corner, like the portfolio's map in light mode.
 */
import { ATTRIBUTION_PNG } from "./attribution.ts";
import { type Canvas, canvasOf, paste } from "./draw.ts";
import { decodePng, encodePng, type Rgba } from "./png.ts";
import { drawMarkers, markersOf, type Pin } from "./pins.ts";
import { type Frame, frameOf, IMAGE, type MapView } from "../src/lib/map-preview-view.ts";

/** Gets one map tile's PNG file by its zoom and position, or null when it can't. */
export type TileSource = (z: number, x: number, y: number) => Promise<Uint8Array | null>;

/** CARTO's tiles are 512 pixels at twice the pixels ("@2x"), matching the image's scale. */
const TILE = 512;
/** Positron's water and land color, which shows where a tile couldn't be fetched. */
const BACKGROUND = [250, 250, 248] as const;

/**
 * The address of one CARTO Positron tile, the raster version of the map's light style
 * (`MAP_STYLES.light` in the portfolio).
 */
export function tileUrl(z: number, x: number, y: number): string {
  return `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`;
}

/** One tile to draw: its zoom and position in the tile grid, and where it goes in the image. */
interface Placed {
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
}

/** The whole tile numbers that cover the pixels from start for length. */
function tileRange(start: number, length: number): number[] {
  const first = Math.floor(start / TILE);
  const last = Math.floor((start + length - 1) / TILE);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * The tiles that cover the image. Tiles above or below the world are left out, and ones past its
 * sides wrap around, as the map repeats the world sideways.
 */
export function tilesFor(frame: Frame): Placed[] {
  const z = Math.round(Math.log2(frame.worldSize / TILE));
  const count = 2 ** z;
  const rows = tileRange(frame.top, IMAGE.height).filter((y) => y >= 0 && y < count);
  return rows.flatMap((y) =>
    tileRange(frame.left, IMAGE.width).map((x) => ({
      z,
      x: ((x % count) + count) % count,
      y,
      left: x * TILE - frame.left,
      top: y * TILE - frame.top,
    })),
  );
}

/** One tile's pixels, or null when it can't be fetched or read, which leaves its square blank. */
async function loadTile(source: TileSource, tile: Placed): Promise<Rgba | null> {
  try {
    const file = await source(tile.z, tile.x, tile.y);
    return file && (await decodePng(file));
  } catch {
    return null;
  }
}

/** Draws every tile, fetched all at once; false when any is left blank. */
async function drawTiles(canvas: Canvas, frame: Frame, source: TileSource): Promise<boolean> {
  const tiles = tilesFor(frame);
  const images = await Promise.all(tiles.map((tile) => loadTile(source, tile)));
  images.forEach((image, i) => {
    if (image) paste(canvas, image, tiles[i]!.left, tiles[i]!.top);
  });
  return images.every(Boolean);
}

/** The map credit, read once per build. */
let attribution: Promise<Rgba> | undefined;

/** Draws the map credit in the bottom right corner. */
async function drawAttribution(canvas: Canvas) {
  attribution ??= decodePng(Uint8Array.from(atob(ATTRIBUTION_PNG), (ch) => ch.charCodeAt(0)));
  const image = await attribution;
  paste(canvas, image, canvas.width - image.width, canvas.height - image.height);
}

/** A drawn preview image, and whether every tile made it in. */
export interface Rendered {
  png: Uint8Array;
  complete: boolean;
}

/** Draws the preview image of the view with the pins, as a PNG file. */
export async function renderPreview(
  view: MapView,
  pins: Pin[],
  source: TileSource,
): Promise<Rendered> {
  const frame = frameOf(view);
  const canvas = canvasOf(IMAGE.width, IMAGE.height, [...BACKGROUND]);
  const complete = await drawTiles(canvas, frame, source);
  drawMarkers(canvas, markersOf(frame, pins));
  await drawAttribution(canvas);
  return { png: await encodePng(canvas.rgb, canvas.width, canvas.height), complete };
}
