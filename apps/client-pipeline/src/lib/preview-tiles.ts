/**
 * The basemap under a day card's drawing of its line: the CARTO raster tiles the map's style is
 * drawn from, laid in a Web Mercator box around the line's points, so the card shows where the
 * day was without loading a whole map per card.
 *
 * Frontend analogy: a map is a grid of 256 px images (tiles) per zoom level, like a sprite sheet
 * cut into squares; each zoom in doubles the grid each way. Placing a few of them behind an SVG is
 * the same as an absolutely positioned background behind a chart.
 */

/** One tile's size in pixels at its own zoom. */
const TILE = 256;

/** The closest the preview zooms in, so one spot (or two close ones) still shows its streets. */
const MAX_ZOOM = 16;

/** A spot in the box, in its units from the top left. */
export type BoxPoint = [number, number];

/** One tile placed in the box: its image and where it goes, in the box's units. */
export interface PlacedTile {
  url: string;
  x: number;
  y: number;
  size: number;
}

/** The box the points are drawn in: where each longitude and latitude goes, and the tiles under it. */
export interface PreviewBox {
  at: (lng: number, lat: number) => BoxPoint;
  tiles: PlacedTile[];
}

/** A longitude and latitude in world pixels at zoom 0, from the top left of the world. */
function mercator(lng: number, lat: number): BoxPoint {
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return [((lng + 180) / 360) * TILE, y * TILE];
}

/** The fractional zoom that fits a span of world pixels (at zoom 0) into room, at most MAX_ZOOM. */
function fitZoom(spanX: number, spanY: number, roomX: number, roomY: number): number {
  const zoom = Math.log2(Math.min(roomX / Math.max(spanX, 1e-9), roomY / Math.max(spanY, 1e-9)));
  return Math.min(zoom, MAX_ZOOM);
}

/** How the tiles are fetched: the light or dark style, and CARTO's API key. */
export interface TileStyle {
  dark: boolean;
  key: string;
}

/** The CARTO raster tile at z, x, y in the style, with the API key, spread over its four hosts. */
function tileUrl(z: number, x: number, y: number, { dark, key }: TileStyle): string {
  const host = "abcd"[(x + y) % 4];
  const style = dark ? "dark_all" : "light_all";
  return `https://${host}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`;
}

/** The tiles at zoom z covering the box whose top left is (left, top) in world pixels at zoom fit. */
function coveringTiles(
  [left, top]: BoxPoint,
  [width, height]: BoxPoint,
  fit: number,
  style: TileStyle,
): PlacedTile[] {
  const z = Math.max(0, Math.min(MAX_ZOOM, Math.ceil(fit)));
  const size = TILE * 2 ** (fit - z);
  const count = 2 ** z;
  const tiles: PlacedTile[] = [];
  for (let ty = Math.floor(top / size); ty * size < top + height; ty++) {
    for (let tx = Math.floor(left / size); tx * size < left + width; tx++) {
      if (ty < 0 || ty >= count) continue;
      const wrapped = ((tx % count) + count) % count;
      tiles.push({
        url: tileUrl(z, wrapped, ty, style),
        x: tx * size - left,
        y: ty * size - top,
        size,
      });
    }
  }
  return tiles;
}

/**
 * The box of width by height (with pad on each side) that fits the points, as a map does: north up
 * and the same scale both ways in Web Mercator, with the basemap tiles under it; none without an API
 * key, since CARTO's tiles carry an "API key required" watermark without one.
 */
export function previewBox(
  points: [number, number][],
  [width, height, pad]: [number, number, number],
  style: TileStyle,
): PreviewBox {
  const world = points.map(([lng, lat]) => mercator(lng, lat));
  const xs = world.map(([x]) => x);
  const ys = world.map(([, y]) => y);
  const [west, east, north, south] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const fit = fitZoom(east - west, south - north, width - pad * 2, height - pad * 2);
  const scale = 2 ** fit;
  const left = ((west + east) / 2) * scale - width / 2;
  const top = ((north + south) / 2) * scale - height / 2;
  const at = (lng: number, lat: number): BoxPoint => {
    const [x, y] = mercator(lng, lat);
    return [x * scale - left, y * scale - top];
  };
  const tiles = style.key ? coveringTiles([left, top], [width, height], fit, style) : [];
  return { at, tiles };
}
