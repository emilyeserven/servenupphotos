/**
 * Map links' previews: the tags that point a map page at its preview image, and the image itself,
 * drawn once per view and then kept in R2.
 *
 * > **Frontend analogy:** the R2 key works like a TanStack Query `queryKey`: the same rounded view
 * > and the same photos always give the same key, so the image is drawn on the first request and
 * > served from R2 after that.
 */
import { type Pin, markersOf } from "./pins.ts";
import { type Fetch, renderPreview } from "./render.ts";
import { nameTags, ogTags, type Preview } from "./tags.ts";
import {
  fitView,
  frameOf,
  IMAGE,
  type MapView,
  parseView,
  previewView,
  viewSearch,
} from "./view.ts";

/** The path of a map preview image; the Worker answers it. */
export const IMAGE_PATH = "/og/map.png";

/** Bump to draw every preview again after changing how they look. */
const STYLE_VERSION = "v1";

/** The photos on the map, and a short fingerprint of them that changes whenever they do. */
export interface MapPins {
  pins: Pin[];
  version: string;
}

/** Reads `map-pins.json` from the built site (see apps/portfolio/map-pins.ts). */
export async function loadPins(siteOrigin: string): Promise<MapPins> {
  const response = await fetch(`${siteOrigin}/map-pins.json`, { cf: { cacheTtl: 300 } });
  if (!response.ok) throw new Error(`map-pins.json: ${response.status}`);
  const text = await response.text();
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  const version = Array.from(hash.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
  return { pins: JSON.parse(text) as Pin[], version };
}

/**
 * The view a map link's preview shows: the link's own center and zoom, or else every photo, as the
 * map opens on a link without them; rounded so near views share an image.
 */
function viewFor(search: URLSearchParams, pins: Pin[]): MapView {
  return previewView(parseView(search) ?? fitView(pins.map(([lng, lat]) => [lng, lat])));
}

/** How many photos are in the preview image of the view. */
function photosIn(view: MapView, pins: Pin[]): number {
  const frame = frameOf(view);
  const inside = markersOf(frame, pins).filter(
    ({ x, y }) => x >= 0 && y >= 0 && x <= IMAGE.width && y <= IMAGE.height,
  );
  return inside.reduce((sum, marker) => sum + marker.count, 0);
}

/** The description under a map link's preview, such as "12 photos in this part of the map." */
function descriptionOf(count: number): string {
  if (count === 0) return "Photos on the Serven Up Photos map.";
  return `${count} ${count === 1 ? "photo" : "photos"} in this part of the map.`;
}

/** A map link's title and preview tags, pointing at the image of its view. */
export function mapPreview(url: URL, { pins, version }: MapPins): Preview {
  const view = viewFor(url.searchParams, pins);
  const image = `${url.origin}${IMAGE_PATH}?${viewSearch(view)}&v=${version}`;
  const title = "Map · Serven Up Photos";
  const description = descriptionOf(photosIn(view, pins));
  return {
    title,
    tags: [
      ...ogTags([
        ["og:type", "website"],
        ["og:site_name", "Serven Up Photos"],
        ["og:title", title],
        ["og:description", description],
        ["og:url", url.href],
        ["og:image", image],
        ["og:image:type", "image/png"],
        ["og:image:width", String(IMAGE.width)],
        ["og:image:height", String(IMAGE.height)],
        ["og:image:alt", `A map of ${description.charAt(0).toLowerCase()}${description.slice(1)}`],
      ]),
      ...nameTags([
        ["description", description],
        ["twitter:card", "summary_large_image"],
      ]),
    ],
  };
}

/** Where a view's image is kept in R2, such as `v1/1a2b3c4d5e6f/12/37.5665/126.978.png`. */
function imageKey(view: MapView, version: string): string {
  return `${STYLE_VERSION}/${version}/${view.zoom}/${view.lat}/${view.lng}.png`;
}

/**
 * Fetches map tiles with CARTO's API key, which its raster tiles need (without one they carry an
 * "API key required" watermark), keeping each in Cloudflare's cache for a week, as they rarely
 * change.
 */
function tileFetcher(cartoKey: string | undefined): Fetch {
  const search = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : "";
  return (tile) => fetch(tile + search, { cf: { cacheTtl: 7 * 86400, cacheEverything: true } });
}

/** Where map images are kept, and CARTO's API key for drawing new ones. */
export interface ImageStore {
  bucket: R2Bucket;
  cartoKey?: string;
}

/** Link preview bots and Cloudflare may keep an image for a day; a new photo changes its address anyway. */
const IMAGE_HEADERS = { "content-type": "image/png", "cache-control": "public, max-age=86400" };

/**
 * Answers a map preview image request: from R2 when it was drawn before, or else draws it, answers
 * with it, and saves it to R2 once the answer is on its way.
 */
export async function mapImage(
  url: URL,
  mapPins: MapPins,
  { bucket, cartoKey }: ImageStore,
  ctx: ExecutionContext,
): Promise<Response> {
  const view = viewFor(url.searchParams, mapPins.pins);
  const key = imageKey(view, mapPins.version);
  const kept = await bucket.get(key);
  if (kept) return new Response(kept.body, { headers: IMAGE_HEADERS });
  const png = await renderPreview(view, mapPins.pins, tileFetcher(cartoKey));
  ctx.waitUntil(bucket.put(key, png, { httpMetadata: { contentType: "image/png" } }));
  return new Response(png, { headers: IMAGE_HEADERS });
}
