/** A box on the map: its west and east longitudes and its south and north latitudes. */
export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Where the Map looks, as its URL keeps it: its center and zoom. */
export interface MapUrlView {
  lat: number;
  lng: number;
  zoom: number;
}

/** The size of the world at zoom 0 in pixels, as MapLibre's 512-pixel tiles draw it. */
const WORLD_PX = 512;

/** The room the Map leaves around a fitted view for its header, buttons and key. */
const PAD = { x: 160, y: 220 };

/** How close a fitted view zooms in at most: a few streets, as the Map opens on photos. */
const MAX_ZOOM = 16;

/** A latitude's height on the Web Mercator map, from 0 at the top to 1 at the bottom. */
function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

/** The latitude at a height on the Web Mercator map. */
function latitudeAt(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

function round(n: number, places: number): number {
  const k = 10 ** places;
  return Math.round(n * k) / k;
}

/**
 * The center and zoom that fit the bounds in a window of width × height pixels, less room for the
 * Map's header and buttons, the way MapLibre's `fitBounds` would, so a link can open the Map there.
 */
export function fitView(bounds: GeoBounds, width: number, height: number): MapUrlView {
  const top = mercatorY(bounds.north);
  const bottom = mercatorY(bounds.south);
  const spanX = Math.max((bounds.east - bounds.west) / 360, 1e-9);
  const spanY = Math.max(bottom - top, 1e-9);
  const fit = Math.min((width - PAD.x) / (spanX * WORLD_PX), (height - PAD.y) / (spanY * WORLD_PX));
  return {
    lat: round(latitudeAt((top + bottom) / 2), 5),
    lng: round((bounds.west + bounds.east) / 2, 5),
    zoom: round(Math.min(Math.log2(Math.max(fit, 1)), MAX_ZOOM), 2),
  };
}
