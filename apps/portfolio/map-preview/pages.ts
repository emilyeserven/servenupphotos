import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Plugin, runnerImport } from "vite";
import { previewPage, SITE_NAME, SITE_URL } from "../photo-previews.ts";
import type { MapPage } from "../src/lib/map-pages.ts";
import { frameOf, IMAGE } from "../src/lib/map-preview-view.ts";
import { markersOf, type Pin } from "./pins.ts";
import { renderPreview, type TileSource, tileUrl } from "./render.ts";

/**
 * After a build, writes the map's place pages (see docs/map-link-previews.md): for each map page in
 * `src/lib/map-pages.ts`, `index.html` with its link preview tags and `preview.png`, a picture of its
 * view drawn from CARTO's tiles with the photo pins.
 *
 * Drawing takes CARTO's API key and a few seconds per new image, so it only runs when
 * `MAP_PREVIEWS=1`, as the deploy workflow sets it, and is skipped without `CARTO_KEY`. Images and tiles are kept in a cache folder
 * between builds, and an image is drawn again only when its view or the pins in it change.
 *
 * > **Frontend analogy:** like the photo pages, this is static site generation for just the
 * > `<head>`, plus one generated image per page; the cache is like a build cache keyed by content.
 */

/** Bump to draw every image again after changing how they look. */
const STYLE_VERSION = "v1";

/** The portfolio app's folder. */
const ROOT = path.join(import.meta.dirname, "..");

/** Where drawn images and fetched tiles are kept between builds. */
const CACHE_DIR = path.join(ROOT, "node_modules/.cache/map-previews");

/** Reads a file, or null when it isn't there. */
async function readIfThere(file: string): Promise<Uint8Array | null> {
  return readFile(file).catch(() => null);
}

/** Writes a file, making its folder first. */
async function writeMaking(file: string, data: Uint8Array | string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

/**
 * CARTO's tiles, from the cache folder or else fetched with the API key. A tile that can't be fetched is null and isn't kept.
 */
function cachedTiles(cartoKey: string): TileSource {
  const search = `?key=${encodeURIComponent(cartoKey)}`;
  return async (z, x, y) => {
    const file = path.join(CACHE_DIR, "tiles", String(z), String(x), `${y}.png`);
    const kept = await readIfThere(file);
    if (kept) return kept;
    const response = await fetch(tileUrl(z, x, y) + search).catch(() => null);
    if (!response?.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeMaking(file, bytes);
    return bytes;
  };
}

/** What a page's image shows, as a short hash: its view and the pins drawn in it. */
function imageKey(page: MapPage, pins: Pin[]): string {
  const markers = markersOf(frameOf(page.view), pins);
  const content = JSON.stringify([STYLE_VERSION, page.view, markers]);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * A page's image from the cache folder, or else drawn and kept there. An image missing a tile isn't
 * kept, so the next build tries again.
 */
async function imageFor(page: MapPage, pins: Pin[], cartoKey: string) {
  const file = path.join(CACHE_DIR, "images", `${imageKey(page, pins)}.png`);
  const kept = await readIfThere(file);
  if (kept) return { png: kept, drawn: false };
  const { png, complete } = await renderPreview(page.view, pins, cachedTiles(cartoKey));
  if (complete) await writeMaking(file, png);
  return { png, drawn: true };
}

/** "1 photo" or "12 photos". */
function photoCount(count: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

/** The page's title and description, such as "Seoul on the map" and "34 photos in Seoul." */
function wordsFor(page: MapPage) {
  const count = photoCount(page.photos.length);
  return page.whole
    ? { title: "Map", description: `${count} on the map.` }
    : { title: `${page.name} on the map`, description: `${count} in ${page.name}.` };
}

/** The page's index.html: the built one with its title and link preview tags. */
function pageHtml(html: string, page: MapPage): string {
  const { title, description } = wordsFor(page);
  return previewPage(html, {
    title,
    description,
    properties: [
      ["og:type", "website"],
      ["og:site_name", SITE_NAME],
      ["og:title", title],
      ["og:description", description],
      ["og:url", `${SITE_URL}${page.path}`],
      ["og:image", `${SITE_URL}${page.path}preview.png`],
      ["og:image:type", "image/png"],
      ["og:image:width", String(IMAGE.width)],
      ["og:image:height", String(IMAGE.height)],
      ["og:image:alt", `A map of ${description.charAt(0).toLowerCase()}${description.slice(1)}`],
    ],
  });
}

/** The map pages, read through Vite so the app's imports work. */
async function loadPages() {
  const src = path.join(ROOT, "src");
  const { module } = await runnerImport<typeof import("../src/lib/map-pages.ts")>(
    path.join(src, "lib/map-pages.ts"),
    {
      configFile: false,
      root: ROOT,
      logLevel: "error",
      resolve: { alias: { "@portfolio": src, "@": src } },
    },
  );
  return [...module.mapPages.values()];
}

/** Every photo on the map as a pin, from the whole map's page: where it is and its average color. */
function pinsOf(pages: MapPage[]): Pin[] {
  const all = pages.find((page) => page.whole)?.photos ?? [];
  return all.map((photo) => [photo.longitude, photo.latitude, photo.averageColor]);
}

/** Writes one page and its image into the built site; true when its image was drawn anew. */
async function writePage(dir: string, html: string, page: MapPage, context: PageContext) {
  const { png, drawn } = await imageFor(page, context.pins, context.cartoKey);
  const pageDir = path.join(dir, page.path);
  await writeMaking(path.join(pageDir, "preview.png"), png);
  await writeFile(path.join(pageDir, "index.html"), pageHtml(html, page));
  return drawn;
}

/** What every page is drawn with. */
interface PageContext {
  pins: Pin[];
  cartoKey: string;
}

/** Writes every map page into the built site in dir, and says how many there are and how many images were drawn. */
async function writePages(dir: string, cartoKey: string): Promise<string> {
  const html = await readFile(path.join(dir, "index.html"), "utf8");
  const pages = await loadPages();
  const context = { pins: pinsOf(pages), cartoKey };
  let drawn = 0;
  for (const page of pages) drawn += Number(await writePage(dir, html, page, context));
  return `Wrote ${pages.length} map pages for link previews (${drawn} images drawn)`;
}

/** The Vite plugin that writes the map pages after a build when `MAP_PREVIEWS=1`. */
export function mapPreviewPages(): Plugin {
  return {
    name: "map-preview-pages",
    apply: (_config, env) => env.command === "build" && process.env.MAP_PREVIEWS === "1",
    async writeBundle(options) {
      // Without a key CARTO marks its tiles "API key required", so there are no map pages at all,
      // and Copy link's addresses fall back to the app, which opens the map there.
      const cartoKey = process.env.CARTO_KEY;
      if (!cartoKey)
        return this.warn("No CARTO_KEY, so the map pages for link previews were skipped");
      this.info(await writePages(options.dir ?? path.join(ROOT, "dist"), cartoKey));
    },
  };
}
