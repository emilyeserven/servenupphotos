// Checks that every /api route the Go backend registers has a screenshot fixture, so `pnpm shot`
// can show every page without a backend (see CLAUDE.md, "Adding a pipeline endpoint"). A route
// with a path parameter, such as `GET /places/{id}/area`, counts as covered by a fixture for any
// value, such as `GET /api/places/dotonbori/area`. Exits 1 and lists the routes without one.
//
// The routes are read from the `mux.HandleFunc("METHOD /path", …)` lines in
// apps/be-pipeline/internal/httpapi; the fixtures from scripts/screenshot-fixtures.mjs.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { defaultFixtures } from "./screenshot-fixtures.mjs";

const root = path.resolve(import.meta.dirname, "..");
const HTTPAPI = path.join(root, "apps/be-pipeline/internal/httpapi");

/**
 * Routes `pnpm shot` answers on its own, or that only the real BFF can answer, so they need no
 * fixture: the health check, the offline copy's thumbnails (drawn as placeholders in
 * screenshot.mjs), an original JPEG download and a resized version, which answers an image that
 * `pnpm shot` draws as a placeholder anyway.
 */
const WITHOUT_FIXTURE = new Set([
  "GET /health",
  "GET /hello",
  "GET /thumbnails",
  "GET /photos/original",
  "POST /photos/versions/{version}",
]);

const ROUTE_LINE = /mux\.Handle(?:Func)?\("((?:GET|POST|PUT|DELETE|PATCH) [^"]+)"/g;

/** Whether the file is Go source the router could register routes in (not a test). */
function registersRoutes(name) {
  return name.endsWith(".go") && !name.endsWith("_test.go");
}

/** The `METHOD /path` routes one Go file registers. */
function routesIn(source) {
  return [...source.matchAll(ROUTE_LINE)].map(([, route]) => route);
}

/** Every `METHOD /path` the backend's route files register. */
async function backendRoutes() {
  const names = (await readdir(HTTPAPI)).filter(registersRoutes);
  const sources = await Promise.all(
    names.map((name) => readFile(path.join(HTTPAPI, name), "utf8")),
  );
  return [...new Set(sources.flatMap(routesIn))].toSorted();
}

/** A regular expression matching the fixture keys that answer the route, with `/api` in front. */
function routePattern(route) {
  const [method, pattern] = route.split(" ");
  const escaped = pattern
    .split("/")
    .map((part) => (/^\{.+\}$/.test(part) ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${method} /api${escaped}$`);
}

const fixtureKeys = Object.keys(defaultFixtures());
const missing = (await backendRoutes()).filter(
  (route) =>
    !WITHOUT_FIXTURE.has(route) && !fixtureKeys.some((key) => routePattern(route).test(key)),
);

if (missing.length > 0) {
  console.error("These backend routes have no fixture in scripts/screenshot-fixtures.mjs:");
  for (const route of missing) console.error(`  ${route}`);
  console.error(
    "Add one for each (or list it in WITHOUT_FIXTURE in scripts/check-fixtures.mjs if `pnpm shot` can never need it).",
  );
  process.exit(1);
}
console.log(`Every backend route has a screenshot fixture (${fixtureKeys.length} fixtures).`);
