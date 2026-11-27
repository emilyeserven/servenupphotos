import { type OsmElement, type OverpassClient, SERVER_TIMEOUT } from "./overpass.js";
import { goFixed, sixPlaces } from "./query.js";
import { trackBetween } from "./track-graph.js";
import {
  firstOf,
  kmBetween,
  type Line,
  MAX_STATIONS,
  NEAR_M,
  NoKindError,
  NoNameError,
  NoTrackError,
  orNone,
  sortLines,
  type Spot,
  type Station,
  type Stop,
} from "./transit-types.js";

/**
 * The transit look-ups on OpenStreetMap's Overpass servers: the lines near two spots
 * (route relations, https://wiki.openstreetmap.org/wiki/Relation:route), one line's track and
 * stops, and stations by name.
 */

/** What a mode's lines are mapped as: their route values, and the tag filters for the ways they run on. */
const ROUTE_KINDS: Record<string, { routes: string; ways: string[] }> = {
  train: { routes: "train|light_rail|monorail|tram", ways: ["[railway]"] },
  subway: { routes: "subway|light_rail|monorail|tram", ways: ["[railway]"] },
  bus: { routes: "bus|trolleybus|coach", ways: ["[highway]"] },
  ferry: { routes: "ferry", ways: ["[route=ferry]"] },
};

/**
 * The Overpass QL for route relations of kind with a way near both from and to. It looks only at
 * the ways kind's lines run on near from, and then only at those lines' own ways near to.
 */
export function linesQuery(mode: string, from: Spot, to: Spot): string {
  const kind = ROUTE_KINDS[mode]!;
  const near = `(around:${NEAR_M},${sixPlaces(from[1])},${sixPlaces(from[0])})`;
  const ways = kind.ways.map((tag) => `way${near}${tag};`).join("");
  return `${SERVER_TIMEOUT}
(${ways})->.w1;
rel(bw.w1)[type=route][route~"^(${kind.routes})$"]->.a;
way(r.a)(around:${NEAR_M},${sixPlaces(to[1])},${sixPlaces(to[0])});
rel(bw)->.b;
rel.a.b;
out tags;`;
}

/** The route relation e as a line, named by its name, or else its number, or else its ID. */
function lineOf(e: OsmElement): Line {
  const t = e.tags ?? {};
  return {
    id: e.id,
    name: firstOf(t.name, t["name:en"], t.ref, `Line ${e.id}`),
    ref: orNone(t.ref),
    colour: orNone(t.colour),
    kind: t.route ?? "",
    from: orNone(t.from),
    to: orNone(t.to),
  };
}

/** The lines of mode's kinds whose track passes near both from and to, sorted by number and name. */
export async function overpassLines(
  client: OverpassClient,
  mode: string,
  from: Spot,
  to: Spot,
  signal?: AbortSignal,
): Promise<Line[]> {
  if (!Object.hasOwn(ROUTE_KINDS, mode)) throw new NoKindError();
  const elements = await client.query(linesQuery(mode, from, to), signal);
  return sortLines(elements.map(lineOf));
}

/** The ways a route relation's members run along, as lines of spots, leaving out platforms. */
function memberLines(e: OsmElement): Spot[][] {
  return (e.members ?? [])
    .filter((m) => m.type === "way" && !m.role.startsWith("platform"))
    .map((m) => (m.geometry ?? []).map((p): Spot => [p.lon, p.lat]));
}

/**
 * Line id's track from the point on it nearest from to the point nearest to, with from and to added
 * at its ends so it joins the photos.
 */
export async function overpassTrack(
  client: OverpassClient,
  id: number,
  from: Spot,
  to: Spot,
  signal?: AbortSignal,
): Promise<Spot[]> {
  const elements = await client.query(`${SERVER_TIMEOUT}rel(${id});out geom;`, signal);
  const track = elements[0] && trackBetween(memberLines(elements[0]), from, to);
  if (!track) throw new NoTrackError();
  return track;
}

/** Line id's stations or stops, in the order the line runs, each named once even when mapped as more than one point. */
export async function overpassStops(
  client: OverpassClient,
  id: number,
  signal?: AbortSignal,
): Promise<Stop[]> {
  const elements = await client.query(
    `${SERVER_TIMEOUT}rel(${id});out body;node(r);out body;`,
    signal,
  );
  const rel = elements.find((e) => e.type === "relation" && e.id === id);
  if (!rel) throw new NoTrackError();
  const nodes = new Map(elements.filter((e) => e.type === "node").map((e) => [e.id, e]));
  const stops = stopsWithRole(rel, nodes, "stop");
  return stops.length > 0 ? stops : stopsWithRole(rel, nodes, "platform");
}

/** rel's nodes whose role starts with role, in order, with a name repeated back to back kept once. */
function stopsWithRole(rel: OsmElement, nodes: Map<number, OsmElement>, role: string): Stop[] {
  const out: Stop[] = [];
  for (const m of rel.members ?? []) {
    const n = m.type === "node" && m.role.startsWith(role) ? nodes.get(m.ref) : undefined;
    const stop = n && stopOf(n, out.length + 1);
    if (stop && out.at(-1)?.name !== stop.name) out.push(stop);
  }
  return out;
}

/** Node n as a stop, named "Stop <number>" when it has no name. */
function stopOf(n: OsmElement, number: number): Stop {
  const tags = n.tags ?? {};
  return {
    name: firstOf(tags.name, tags["name:en"], `Stop ${number}`),
    latitude: n.lat ?? 0,
    longitude: n.lon ?? 0,
  };
}

/** How far from the spot given, in meters, a station search looks. */
const STATIONS_NEAR_M = 30000;

/** How many stations the server sends at most, before they're ranked by the words typed. */
const STATIONS_LIMIT = 3000;

/**
 * What a mode's stations are mapped as: one Overpass tag filter per statement, each starting with a
 * plain key so the server can use its tag index, and whether the server matches the name too (only
 * bus stops, as a city has tens of thousands).
 */
const STATION_KINDS: Record<string, { tags: string[]; byName: boolean }> = {
  train: {
    tags: [
      '[railway~"^(station|halt)$"][station!~"^(subway|light_rail|monorail)$"]',
      "[public_transport=station][train=yes]",
    ],
    byName: false,
  },
  subway: {
    tags: [
      '[railway=station][station~"^(subway|light_rail|monorail)$"]',
      "[public_transport=station][subway=yes]",
    ],
    byName: false,
  },
  bus: {
    tags: ["[highway=bus_stop]", "[amenity=bus_station]", "[public_transport=station][bus=yes]"],
    byName: true,
  },
  ferry: {
    tags: ["[amenity=ferry_terminal]", '[public_transport~"^(station|stop_position)$"][ferry=yes]'],
    byName: false,
  },
};

/** The tags a station's name can be in, in any language, such as "name", "name:ja-Latn" or "official_name". */
const NAME_KEYS = "^((official|alt|short|old)_)?name(:[A-Za-z_-]+)?$";

/**
 * The Overpass QL for mode's stations within STATIONS_NEAR_M of near, rounded to about a kilometer so
 * nearby searches share an answer, and for bus stops only those whose name contains word.
 */
export function stationsQuery(mode: string, word: string, near: Spot): string {
  const kind = STATION_KINDS[mode]!;
  const around = `(around:${STATIONS_NEAR_M},${goFixed(near[1], 2)},${goFixed(near[0], 2)})`;
  const union = kind.tags.map((t) => `nwr${t}${around};`).join("");
  return `${SERVER_TIMEOUT}(${union})->.s;${nameFilter(kind.byName, word)};out tags center ${STATIONS_LIMIT};`;
}

/** The statement keeping the stations whose name has word, for a kind matched by name on the server, or else all. */
function nameFilter(byName: boolean, word: string): string {
  if (!byName) return "nwr.s";
  const pattern = word
    .replace(/[\\.+*?()|[\]{}^$]/g, "\\$&")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
  return `nwr.s[~"${NAME_KEYS}"~"${pattern}",i]`;
}

/**
 * Mode's stations within STATIONS_NEAR_M of near whose names in any language have at least one of
 * name's words, those with the most first, then the nearest, each name once. So "Shimonoseki Kokusai
 * Terminal" finds 下関港国際ターミナル by its English or romaji name.
 */
export async function overpassStations(
  client: OverpassClient,
  mode: string,
  name: string,
  near: Spot,
  signal?: AbortSignal,
): Promise<Station[]> {
  if (!Object.hasOwn(STATION_KINDS, mode)) throw new NoKindError();
  const words = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== "");
  if (words.length === 0) throw new NoNameError();
  const elements = await client.query(stationsQuery(mode, longest(words), near), signal);
  return bestStations(elements, words, near);
}

/** The longest of words (the first of equals), the one fewest names have. */
function longest(words: string[]): string {
  return words.reduce((best, w) => ([...w].length > [...best].length ? w : best));
}

/** Elements as stations whose names have any of words, the most first then the nearest, each name once, at most MAX_STATIONS. */
export function bestStations(elements: OsmElement[], words: string[], near: Spot): Station[] {
  const found = elements
    .map((e) => ({ station: stationOf(e, near), hits: wordHits(e.tags ?? {}, words) }))
    .filter((r): r is { station: Station; hits: number } => r.station !== undefined && r.hits > 0)
    .toSorted((a, b) => b.hits - a.hits || a.station.km - b.station.km);
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const { station } of found) {
    if (!seen.has(station.name) && out.length < MAX_STATIONS) out.push(station);
    seen.add(station.name);
  }
  return out;
}

/** How many of words, each lower case, are in any of tags' names. */
function wordHits(tags: Record<string, string>, words: string[]): number {
  const keys = new RegExp(NAME_KEYS);
  const names = Object.entries(tags)
    .filter(([k]) => keys.test(k))
    .map(([, v]) => `${v.toLowerCase()}\n`)
    .join("");
  return words.filter((w) => names.includes(w)).length;
}

/** e as a station, or undefined when it has no name or no spot. */
function stationOf(e: OsmElement, near: Spot): Station | undefined {
  const tags = e.tags ?? {};
  const { lat, lon } = e.center ?? { lat: e.lat ?? 0, lon: e.lon ?? 0 };
  const name = firstOf(tags.name, tags["name:en"]);
  if (name === "" || (lat === 0 && lon === 0)) return undefined;
  const en = tags["name:en"];
  return {
    name,
    nameEn: en === name ? undefined : orNone(en),
    latitude: lat,
    longitude: lon,
    km: kmBetween(near, [lon, lat]),
  };
}
