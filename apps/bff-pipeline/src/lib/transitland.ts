import { MemoCache } from "./memo.js";
import { anySignal, type Log, quietLog, sixPlaces, sortedQuery, statusLine } from "./query.js";
import { meters, trackBetween } from "./track-graph.js";
import {
  firstOf,
  type Line,
  NEAR_M,
  NoKindError,
  NoTrackError,
  orNone,
  sortLines,
  type Spot,
  type Stop,
  USER_AGENT,
} from "./transit-types.js";

/**
 * Transitland (https://www.transit.land) gathers the timetables transit agencies publish as GTFS,
 * with each route's shape and stops: a second place to find a hop's line when OpenStreetMap's
 * Overpass servers are busy. It needs a free API key, TRANSITLAND_API_KEY; TRANSITLAND_URL points
 * it at another server.
 */

/** The Line source of a line found on Transitland. */
export const SOURCE_TRANSITLAND = "transitland";

/** Transitland's REST API, used unless TRANSITLAND_URL names another. */
export const DEFAULT_TRANSITLAND_URL = "https://transit.land/api/v2/rest";

/** How long Transitland gets to answer. */
const TRANSITLAND_TIMEOUT_MS = 30_000;

/** Thrown when TRANSITLAND_API_KEY isn't set. */
export class NoTransitlandKeyError extends Error {
  constructor() {
    super("no Transitland API key");
  }
}

/** Transitland not answering, or answering other than 200 OK. */
export class TransitlandError extends Error {
  constructor(reason: string) {
    super(`Transitland didn't answer: ${reason}`);
  }
}

/** The route types from first to last, joined by commas. */
function typeRange(first: number, last: number): string {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i).join(",");
}

/**
 * For each mode, the GTFS route types its lines can have: the basic ones
 * (https://gtfs.org/documentation/schedule/reference/#routestxt) and the extended ones some feeds use
 * instead (https://developers.google.com/transit/gtfs/reference/extended-route-types).
 */
const TRANSITLAND_TYPES: Record<string, string> = {
  train: `2,0,12,${typeRange(100, 117)}`,
  subway: `1,0,12,${typeRange(400, 405)}`,
  bus: `3,11,200,201,202,204,800,${typeRange(700, 716)}`,
  ferry: "4,1000,1200",
};

/** The OpenStreetMap kinds the basic GTFS route types are shown as. */
const KIND_NAMES: Record<number, string> = {
  0: "tram",
  1: "subway",
  2: "train",
  3: "bus",
  4: "ferry",
  11: "trolleybus",
  12: "monorail",
};

/** The kinds of extended route types, by their hundreds. */
const EXTENDED_KINDS: Record<number, string> = {
  1: "train",
  2: "bus",
  4: "subway",
  7: "bus",
  8: "trolleybus",
  9: "tram",
  10: "ferry",
  12: "ferry",
};

/** The OpenStreetMap kind a route type is shown as, an extended type by its hundreds. */
export function tlKind(type: number): string {
  return (type < 100 ? KIND_NAMES[type] : EXTENDED_KINDS[Math.trunc(type / 100)]) ?? "";
}

/** A GeoJSON geometry: a route's LineString or MultiLineString, or a stop's Point. */
interface TlGeometry {
  type?: string;
  coordinates?: unknown;
}

/** One route in a Transitland answer. */
export interface TlRoute {
  id: number;
  /** Transitland's ID for the route across feeds: the same in two copies of one operator's feed. */
  onestop_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_color?: string;
  route_type?: number;
  agency?: { agency_name?: string };
  geometry?: TlGeometry | null;
  route_stops?: { stop?: { stop_name?: string; geometry?: TlGeometry | null } }[];
}

/** Whether v is a list of [longitude, latitude] points. */
function isLine(v: unknown): v is Spot[] {
  return (
    Array.isArray(v) && v.every((p) => Array.isArray(p) && p.every((n) => typeof n === "number"))
  );
}

/** g's lines: one for a LineString, each for a MultiLineString, and none for anything else. */
function geometryLines(g: TlGeometry | null | undefined): Spot[][] {
  const coordinates = g?.coordinates;
  if (g?.type === "LineString" && isLine(coordinates)) return [coordinates.map(toSpot)];
  if (g?.type === "MultiLineString" && Array.isArray(coordinates) && coordinates.every(isLine)) {
    return coordinates.map((line) => line.map(toSpot));
  }
  return [];
}

/** A point as a spot, a missing number read as 0. */
function toSpot(p: number[]): Spot {
  return [p[0] ?? 0, p[1] ?? 0];
}

/** g's point when it's a Point. */
function geometryPoint(g: TlGeometry | null | undefined): Spot | undefined {
  const c = g?.coordinates;
  return g?.type === "Point" && Array.isArray(c) && c.every((n) => typeof n === "number")
    ? toSpot(c)
    : undefined;
}

/** The routes in both lists, the first copy of each, as lines sorted by number and name. */
function bothNear(a: TlRoute[], b: TlRoute[]): Line[] {
  const ids = new Set(b.map((r) => r.id));
  return sortLines(
    firstCopies(a)
      .filter((r) => ids.has(r.id))
      .map(tlLine),
  );
}

/** The routes with each listed once, when Transitland has two copies of an operator's feed. */
function firstCopies(routes: TlRoute[]): TlRoute[] {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const id = r.onestop_id ?? "";
    const dup = id !== "" && seen.has(id);
    seen.add(id);
    return !dup;
  });
}

/** r as a line, named by its long name, or else its number, with its agency as where it runs from. */
function tlLine(r: TlRoute): Line {
  const color = r.route_color ?? "";
  return {
    id: r.id,
    name: firstOf(r.route_long_name, r.route_short_name, `Route ${r.id}`),
    ref: orNone(r.route_short_name),
    colour: color === "" ? undefined : `#${color.replace(/^#/, "")}`,
    kind: tlKind(r.route_type ?? 0),
    from: orNone(r.agency?.agency_name),
    source: SOURCE_TRANSITLAND,
  };
}

/** r's stops, ordered by where they fall along its longest shape, each name once. */
function tlStops(r: TlRoute): Stop[] {
  const shape = geometryLines(r.geometry).reduce<Spot[]>(
    (best, line) => (line.length > best.length ? line : best),
    [],
  );
  const found = (r.route_stops ?? []).flatMap((rs) => {
    const p = geometryPoint(rs.stop?.geometry);
    const name = rs.stop?.stop_name ?? "";
    return p && name !== ""
      ? [{ stop: { name, latitude: p[1], longitude: p[0] }, at: nearestIndex(shape, p) }]
      : [];
  });
  const out: Stop[] = [];
  const seen = new Set<string>();
  for (const { stop } of found.toSorted((a, b) => a.at - b.at)) {
    if (!seen.has(stop.name)) out.push(stop);
    seen.add(stop.name);
  }
  return out;
}

/** The index of the point of line nearest p; 0 with none. */
function nearestIndex(line: Spot[], p: Spot): number {
  let best = 0;
  line.forEach((q, i) => {
    if (meters(p, q) < meters(p, line[best]!)) best = i;
  });
  return best;
}

/** What a Transitland client is built from; tests pass a fake fetch. */
export interface TransitlandOptions {
  url: string;
  /** TRANSITLAND_API_KEY; "" when it isn't set. */
  key: string;
  fetch?: typeof fetch;
  log?: Log;
}

/** Looks up lines, tracks and stops on Transitland, keeping each answer for a day. */
export class TransitlandClient {
  readonly #cache = new MemoCache<TlRoute[]>(24 * 60 * 60 * 1000, 200);

  constructor(private readonly options: TransitlandOptions) {}

  /** The routes of mode's kinds with a stop within NEAR_M of both from and to, as lines sorted by number and name. */
  async lines(mode: string, from: Spot, to: Spot, signal?: AbortSignal): Promise<Line[]> {
    if (!Object.hasOwn(TRANSITLAND_TYPES, mode)) throw new NoKindError();
    const types = TRANSITLAND_TYPES[mode]!;
    const near = await this.#routesNear(types, from, signal);
    const there = await this.#routesNear(types, to, signal);
    return bothNear(near, there);
  }

  /** Route id's shape from the point nearest from to the point nearest to, with from and to added at its ends. */
  async track(id: number, from: Spot, to: Spot, signal?: AbortSignal): Promise<Spot[]> {
    const route = await this.#route(id, signal);
    const track = trackBetween(geometryLines(route.geometry), from, to);
    if (!track) throw new NoTrackError();
    return track;
  }

  /** Route id's stops in the order its shape passes them, each name once. */
  async stops(id: number, signal?: AbortSignal): Promise<Stop[]> {
    return tlStops(await this.#route(id, signal));
  }

  /** The routes of the GTFS types with a stop within NEAR_M of at. */
  #routesNear(types: string, at: Spot, signal?: AbortSignal): Promise<TlRoute[]> {
    const query = sortedQuery([
      ["lat", sixPlaces(at[1])],
      ["lon", sixPlaces(at[0])],
      ["radius", String(NEAR_M)],
      ["route_types", types],
      ["limit", "100"],
    ]);
    return this.#ask(`/routes?${query}`, signal);
  }

  /** Route id with its shape and stops. */
  async #route(id: number, signal?: AbortSignal): Promise<TlRoute> {
    const [route] = await this.#ask(`/routes/${id}`, signal);
    if (!route) throw new NoTrackError();
    return route;
  }

  /** Gets path from Transitland's REST API and reads its routes, from the cache when it was asked before. */
  async #ask(path: string, signal?: AbortSignal): Promise<TlRoute[]> {
    if (this.options.key === "") throw new NoTransitlandKeyError();
    const kept = this.#cache.get(path);
    if (kept) return kept;
    const body = await this.#get(path, signal);
    let routes: TlRoute[];
    try {
      routes = (JSON.parse(body) as { routes?: TlRoute[] }).routes ?? [];
    } catch {
      throw new TransitlandError("its answer couldn't be read");
    }
    this.#cache.put(path, routes);
    return routes;
  }

  /** Sends one request for path with the API key and reads its body, logging how long it took. */
  async #get(path: string, signal?: AbortSignal): Promise<string> {
    const start = Date.now();
    const log = this.options.log ?? quietLog;
    try {
      const res = await (this.options.fetch ?? globalThis.fetch)(`${this.options.url}${path}`, {
        headers: { apikey: this.options.key, "user-agent": USER_AGENT },
        signal: anySignal(signal, AbortSignal.timeout(TRANSITLAND_TIMEOUT_MS)),
      });
      if (res.status !== 200) throw new Error(`it answered ${statusLine(res)}`);
      const body = await res.text();
      log.info({ path, tookMs: Date.now() - start, bytes: body.length }, "transitland request");
      return body;
    } catch (error) {
      log.info({ path, tookMs: Date.now() - start, err: String(error) }, "transitland request");
      throw new TransitlandError(error instanceof Error ? error.message : String(error));
    }
  }
}
