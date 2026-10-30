// Takes screenshots of the portfolio or the pipeline UI in a headless browser, with nothing else
// running: it starts the app's Vite dev server, answers the pipeline's /api requests from
// scripts/screenshot-fixtures.mjs, and draws a placeholder for every photo on the R2 CDN and a
// plain background for the map's tiles, since a sandbox usually can't reach either.
//
//   pnpm shot <portfolio|pipeline> <path> [options]
//
//   --name <name>      file name without .png (default: from the path, such as "gallery")
//   --out <dir>        folder to save to (default: screenshots/, git-ignored)
//   --mobile           a 390 × 844 phone screen instead of 1280 × 800
//   --dark             dark mode
//   --full             the whole page, not just the screen
//   --wait <text>      wait until this text is on the page before taking it
//   --fixtures <file>  a module whose default export takes the fixtures and returns the ones to use
//   --script <file>    a module whose default export is async ({ page, shot }) => {…}, to click
//                      around and call `await shot("name")` for each screenshot, in place of one
//   --live             send /api to the real BFF on :8080 (`pnpm dev:pipeline`) instead of fixtures
//
// Chromium comes from Playwright: in a sandbox with PLAYWRIGHT_BROWSERS_PATH set it's already
// there; elsewhere run `pnpm exec playwright-core install chromium` once.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { defaultFixtures, photoSizes } from "./screenshot-fixtures.mjs";

const root = path.resolve(import.meta.dirname, "..");
const APPS = { portfolio: "apps/portfolio", pipeline: "apps/client-pipeline" };
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string" },
    out: { type: "string", default: "screenshots" },
    mobile: { type: "boolean", default: false },
    dark: { type: "boolean", default: false },
    full: { type: "boolean", default: false },
    wait: { type: "string" },
    fixtures: { type: "string" },
    script: { type: "string" },
    live: { type: "boolean", default: false },
  },
});

const [app, urlPath = "/"] = positionals;
if (!APPS[app]) {
  console.error(
    "Usage: pnpm shot <portfolio|pipeline> <path> [--name n] [--out dir] [--mobile] [--dark] …",
  );
  process.exit(1);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/** Resolves with true once url answers, or false if it doesn't within 30 seconds or vite stops. */
async function waitForServer(url, vite) {
  for (let i = 0; i < 300 && vite.exitCode === null; i++) {
    const ok = await fetch(url).then(
      (res) => res.ok,
      () => false,
    );
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

/** Starts the app's Vite dev server and resolves with its URL once it answers. */
async function startVite(appDir) {
  const port = await freePort();
  const vite = spawn(
    path.join(root, appDir, "node_modules/.bin/vite"),
    ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: path.join(root, appDir), stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  vite.stdout.on("data", (chunk) => (output += chunk));
  vite.stderr.on("data", (chunk) => (output += chunk));
  const url = `http://127.0.0.1:${port}`;
  if (await waitForServer(url, vite)) return { url, vite };
  vite.kill();
  throw new Error(`Vite didn't start:\n${output}`);
}

/** The default export of the module at file, a path from the command line. */
async function importOption(file) {
  return (await import(pathToFileURL(path.resolve(file)).href)).default;
}

async function loadFixtures() {
  const fixtures = defaultFixtures();
  return opts.fixtures ? (await importOption(opts.fixtures))(fixtures) : fixtures;
}

function requestBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return undefined;
  }
}

/** A function fixture's result for this request, or the fixture itself. */
async function fixtureResult(fixture, url, request) {
  if (typeof fixture !== "function") return fixture;
  return fixture({ url, body: requestBody(request) });
}

/** A fixture's answer as { status, body }; a plain result is a 200 with it as the body. */
async function fixtureAnswer(fixture, url, request) {
  const result = await fixtureResult(fixture, url, request);
  return typeof result?.status === "number" ? result : { status: 200, body: result };
}

/** Answers a pipeline /api request from the fixtures, or says which fixture is missing. */
async function answerApi(route, fixtures, sizes) {
  const request = route.request();
  const url = new URL(request.url());
  // The offline copy's thumbnails are drawn like the R2 photos they stand for.
  if (url.pathname === "/api/thumbnails") {
    const photo = url.searchParams.get("url") ?? "";
    return route.fulfill({ contentType: "image/svg+xml", body: placeholderImage(photo, sizes) });
  }
  const key = `${request.method()} ${url.pathname}`;
  if (!(key in fixtures)) {
    console.warn(`No fixture for ${key}; answering 501. Add one with --fixtures.`);
    return route.fulfill({ status: 501, json: { message: `No screenshot fixture for ${key}` } });
  }
  const { status, body } = await fixtureAnswer(fixtures[key], url, request);
  return route.fulfill({ status, json: body });
}

const VERSION_NAME =
  /^(.*?)(?:-(xlarge|large|medium|small|xsmall|preview|thumbnail|thumbnailpreview))?\.\w+$/;

/** The photo an R2 object is of, by its key's stem, and its proportions. */
function placeholderSize(url, sizes) {
  const file = new URL(url).pathname.split("/").pop();
  const [, stem = file, version = ""] = file.match(VERSION_NAME) ?? [];
  if (version.startsWith("thumbnail")) return { stem, width: 1, height: 1 };
  return { stem, width: 3, height: 2, ...sizes.get(stem) };
}

/** A number from 0 to 359 that's the same for the same text. */
function hueOf(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** A made-up photo for an R2 object: a gradient, in the photo's proportions, colored by its name. */
function placeholderImage(url, sizes) {
  const size = placeholderSize(url, sizes);
  const hue = hueOf(size.stem);
  const width = 1200;
  const height = Math.round((width * size.height) / size.width);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hue} 60% 72%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 45% 38%)"/>
</linearGradient></defs>
<rect width="100%" height="100%" fill="url(#sky)"/>
<circle cx="${width * 0.7}" cy="${height * 0.32}" r="${Math.min(width, height) * 0.12}" fill="hsl(${(hue + 180) % 360} 80% 88%)" opacity="0.8"/>
<path d="M0 ${height * 0.75} Q ${width * 0.3} ${height * 0.55} ${width * 0.55} ${height * 0.72} T ${width} ${height * 0.68} V ${height} H 0 Z" fill="hsl(${(hue + 200) % 360} 35% 22%)" opacity="0.85"/>
</svg>`;
}

/** A map style with only a background, standing in for the basemap's tiles. */
function blankMapStyle(dark) {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": dark ? "#262626" : "#e5e7eb" },
      },
    ],
  };
}

const isPhotoHost = (url) =>
  url.hostname === "cdn.servenupphotos.net" || url.hostname.endsWith(".r2.dev");
const isMapStyle = (url) =>
  url.hostname === "basemaps.cartocdn.com" && url.pathname.endsWith("style.json");

/** Answers a request outside the app: photos and the map style are made up, the rest dropped. */
function answerOutside(route, sizes) {
  const url = new URL(route.request().url());
  if (isPhotoHost(url)) {
    return route.fulfill({ contentType: "image/svg+xml", body: placeholderImage(url.href, sizes) });
  }
  if (isMapStyle(url)) {
    return route.fulfill({ json: blankMapStyle(url.pathname.includes("dark")) });
  }
  // Anything else outside the app (fonts, tiles, analytics) is left out rather than waited on.
  return route.abort();
}

/** The pipeline has no theme switcher; its styles follow a .dark class on <html>. */
async function addDarkClass(context) {
  await context.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () =>
      document.documentElement.classList.add("dark"),
    ),
  );
}

/** Answers the pipeline's /api requests from the fixtures, unless they go to the real BFF. */
async function routeApi(context, base, sizes) {
  if (opts.live) return;
  const fixtures = await loadFixtures();
  await context.route(
    (url) => url.origin === base && url.pathname.startsWith("/api/"),
    (route) => answerApi(route, fixtures, sizes),
  );
}

function contextOptions() {
  return {
    ...VIEWPORTS[opts.mobile ? "mobile" : "desktop"],
    colorScheme: opts.dark ? "dark" : "light",
  };
}

async function newContext(browser, base) {
  const context = await browser.newContext(contextOptions());
  if (opts.dark && app === "pipeline") await addDarkClass(context);
  const sizes = photoSizes();
  await context.route(
    (url) => url.origin !== base,
    (route) => answerOutside(route, sizes),
  );
  if (app === "pipeline") await routeApi(context, base, sizes);
  return context;
}

/** Saves the page as <out>/<name>.png once its images have loaded and faded in. */
async function takeShot(page, name) {
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: 10_000,
    })
    .catch(() => {});
  await page.waitForTimeout(400);
  const file = path.join(path.resolve(opts.out), `${name}.png`);
  await page.screenshot({ path: file, fullPage: opts.full });
  console.log(file);
}

/** The file name for a single screenshot, such as "albums-test-mobile" for /albums/test. */
function defaultName() {
  const fromPath = urlPath
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "-");
  const suffix = `${opts.mobile ? "-mobile" : ""}${opts.dark ? "-dark" : ""}`;
  return `${fromPath || "home"}${suffix}`;
}

async function capture(browser, base) {
  const context = await newContext(browser, base);
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`Page error: ${error.message}`));
  await mkdir(path.resolve(opts.out), { recursive: true });
  await page.goto(new URL(urlPath, base).href, { waitUntil: "networkidle" });
  if (opts.wait) await page.getByText(opts.wait).first().waitFor();
  const shot = (name) => takeShot(page, name);
  if (opts.script) await (await importOption(opts.script))({ page, shot });
  else await shot(opts.name ?? defaultName());
}

const { url: base, vite } = await startVite(APPS[app]);
const browser = await chromium.launch();
try {
  await capture(browser, base);
} finally {
  await browser.close();
  vite.kill();
}
