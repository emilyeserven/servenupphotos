/**
 * Where a map link is looking, and how that becomes pixels in the preview image.
 *
 * The image is 1200 × 630, the size link previews use, drawn as a 600 × 315 view of the map at
 * twice the pixels (like a phone's screen), so the map's labels are a readable size once the
 * preview is shrunk into a chat or a feed.
 */

/** A map link's center and zoom, as the map keeps them in its URL (`?lat=…&lng=…&zoom=…`). */
export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

/** The preview image's size in pixels. */
export const IMAGE = { width: 1200, height: 630 } as const;

/** How many image pixels make one of the map's pixels. */
export const SCALE = 2;

/** The closest the preview zooms; CARTO's tiles go a little further, but rarely with more to see. */
const MAX_ZOOM = 17;

/** Where the map opens with no photos: the whole world (WORLD_VIEW in the portfolio's map). */
const WORLD_VIEW: MapView = { lat: 25, lng: 20, zoom: 1 };

/** The value as a number from min to max, or undefined. */
function numberIn(value: string | null, min: number, max: number): number | undefined {
  const n = value ? Number(value) : Number.NaN;
  return n >= min && n <= max ? n : undefined;
}

/**
 * The view a map link's search asks for, with the same limits as the map (`parseMapView` in the
 * portfolio), or null when it doesn't give all three.
 */
export function parseView(search: URLSearchParams): MapView | null {
  const lat = numberIn(search.get("lat"), -90, 90);
  const lng = numberIn(search.get("lng"), -180, 180);
  const zoom = numberIn(search.get("zoom"), 0, 24);
  return lat === undefined || lng === undefined || zoom === undefined ? null : { lat, lng, zoom };
}

/**
 * The view as the preview draws it, so links that look nearly the same share one image: the center
 * rounded to 4 decimal places (about 10 meters) and the zoom down to a whole number, which never
 * shows less than the link does, and no closer than MAX_ZOOM.
 */
export function previewView(view: MapView): MapView {
  return {
    lat: Number(view.lat.toFixed(4)),
    lng: Number(view.lng.toFixed(4)),
    zoom: Math.min(MAX_ZOOM, Math.max(0, Math.floor(view.zoom))),
  };
}

/** The view's search, such as `lat=37.5665&lng=126.978&zoom=12`. */
export function viewSearch(view: MapView): string {
  return new URLSearchParams({
    lat: String(view.lat),
    lng: String(view.lng),
    zoom: String(view.zoom),
  }).toString();
}

/** How far across the world a longitude is, from 0 at 180° W to 1 at 180° E. */
function mercatorX(lng: number): number {
  return (lng + 180) / 360;
}

/** How far down the world a latitude is in Web Mercator, from 0 at the top to 1 at the bottom. */
function mercatorY(lat: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

/** The latitude at a distance down the world in Web Mercator (the inverse of mercatorY). */
function latitudeAt(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/**
 * Where the view puts the world in the image: how wide the world is in image pixels, and the
 * image's top left corner in those pixels, rounded to whole pixels.
 */
export interface Frame {
  worldSize: number;
  left: number;
  top: number;
}

/** The frame for a view. MapLibre's world is 512 of its pixels wide at zoom 0. */
export function frameOf(view: MapView): Frame {
  const worldSize = 512 * SCALE * 2 ** view.zoom;
  return {
    worldSize,
    // Whole pixels, so tiles line up with the image's pixels.
    left: Math.round(mercatorX(view.lng) * worldSize - IMAGE.width / 2),
    top: Math.round(mercatorY(view.lat) * worldSize - IMAGE.height / 2),
  };
}

/**
 * Where a point is in the image, in pixels from its top left. Its longitude is taken from the copy
 * of the world nearest the image's center, as the map repeats the world sideways.
 */
export function pointIn(frame: Frame, lng: number, lat: number): { x: number; y: number } {
  const center = frame.left + IMAGE.width / 2;
  const x = mercatorX(lng) * frame.worldSize;
  const shift = Math.round((center - x) / frame.worldSize) * frame.worldSize;
  return { x: x + shift - frame.left, y: mercatorY(lat) * frame.worldSize - frame.top };
}

/** Room left around the photos when the preview fits them, in the map's pixels; more at the top, like the map. */
const FIT_PADDING = { top: 70, right: 40, bottom: 40, left: 40 };

/** The closest the preview zooms to fit the photos, like the map's opening view. */
const FIT_MAX_ZOOM = 14;

/** The smallest and largest of the values. */
function extent(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

/**
 * The view that fits every photo, as the map opens on a link with no center and zoom; the whole
 * world when there are none. Each pin is [longitude, latitude].
 */
export function fitView(pins: [number, number][]): MapView {
  if (pins.length === 0) return WORLD_VIEW;
  const [x0, x1] = extent(pins.map(([lng]) => mercatorX(lng)));
  const [y0, y1] = extent(pins.map(([, lat]) => mercatorY(lat)));
  const room = {
    x: IMAGE.width / SCALE - FIT_PADDING.left - FIT_PADDING.right,
    y: IMAGE.height / SCALE - FIT_PADDING.top - FIT_PADDING.bottom,
  };
  const scale = Math.min(room.x / Math.max(x1 - x0, 1e-9), room.y / Math.max(y1 - y0, 1e-9));
  const zoom = Math.min(FIT_MAX_ZOOM, Math.log2(scale / 512));
  // The padding is uneven, so the center sits a little below the photos' middle.
  const shiftY = (FIT_PADDING.top - FIT_PADDING.bottom) / 2 / (512 * 2 ** zoom);
  return {
    lat: latitudeAt((y0 + y1) / 2 - shiftY),
    lng: ((x0 + x1) / 2) * 360 - 180,
    zoom: Math.max(0, zoom),
  };
}
