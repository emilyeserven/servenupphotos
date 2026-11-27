import { anySignal, type Log, quietLog, sixPlaces, sortedQuery, statusLine } from "./query.js";
import {
  kmBetween,
  MAX_STATIONS,
  NoKindError,
  NoNameError,
  type Spot,
  type Station,
  USER_AGENT,
} from "./transit-types.js";

/**
 * Station search on Photon (https://photon.komoot.io), a search-as-you-type service over
 * OpenStreetMap's data run by komoot. It answers a name search in well under a second, where
 * Overpass runs a whole database query, but can only filter by one tag, so a train search there
 * can't leave out subway stations. PHOTON_URL points it at another server.
 */

/** The public Photon server, used unless PHOTON_URL names another. */
export const DEFAULT_PHOTON_URL = "https://photon.komoot.io/api/";

/** How long Photon gets to answer. */
const PHOTON_TIMEOUT_MS = 15_000;

/**
 * For each mode, the OpenStreetMap "key:value" tags its stations are found by on Photon, any of
 * which may match (https://github.com/komoot/photon#filter-results-by-tags-and-keys).
 */
const PHOTON_TAGS: Record<string, string[]> = {
  train: ["railway:station", "railway:halt"],
  subway: ["railway:station"],
  bus: ["highway:bus_stop", "amenity:bus_station"],
  ferry: ["amenity:ferry_terminal"],
};

/** How far, in degrees (about 100 km), Photon looks either side of the spot given. */
const BBOX_DEG = 1.0;

/** The part of Photon's GeoJSON answer a station is read from. */
interface PhotonAnswer {
  features?: { geometry?: { coordinates?: number[] }; properties?: { name?: string } }[];
}

/** Photon not answering, or answering other than 200 OK. */
export class PhotonError extends Error {
  constructor(reason: string) {
    super(`Photon (photon.komoot.io) didn't answer: ${reason}`);
  }
}

/**
 * Words that say what a stop is rather than which one, such as "station" in "Shimonoseki Station".
 * OpenStreetMap usually leaves them out of the name, and Photon then finds nothing with them.
 */
const KIND_WORDS = new Set([
  "station",
  "stn",
  "sta",
  "stop",
  "halt",
  "terminal",
  "port",
  "pier",
  "駅",
  "港",
]);

/** name without its kind words, such as "Shimonoseki" for "Shimonoseki Station", or name itself when nothing else would be left. */
export function placeName(name: string): string {
  const kept = name
    .split(/\s+/)
    .filter((w) => w !== "" && !KIND_WORDS.has(w.replace(/^[.,]+|[.,]+$/g, "").toLowerCase()));
  return kept.length === 0 ? name : kept.join(" ");
}

/** The query string for a Photon search for name near near, kept to tags and a box about 100 km around it. */
export function photonQuery(tags: string[], name: string, near: Spot): string {
  const box = [near[0] - BBOX_DEG, near[1] - BBOX_DEG, near[0] + BBOX_DEG, near[1] + BBOX_DEG];
  return sortedQuery([
    ["q", name],
    ["lat", sixPlaces(near[1])],
    ["lon", sixPlaces(near[0])],
    ["bbox", box.map(sixPlaces).join(",")],
    ["limit", String(MAX_STATIONS * 2)],
    ["lang", "en"],
    ...tags.map((t): [string, string] => ["osm_tag", t]),
  ]);
}

/** One feature of Photon's answer: its name ("" when none) and its spot ([0, 0] when none). */
function featureOf(f: NonNullable<PhotonAnswer["features"]>[number]): { name: string; at: Spot } {
  const coordinates = f.geometry?.coordinates ?? [];
  return { name: f.properties?.name ?? "", at: [coordinates[0] ?? 0, coordinates[1] ?? 0] };
}

/** Answer's features as stations, in Photon's order, each name once and at most MAX_STATIONS. */
function photonStations(answer: PhotonAnswer, near: Spot): Station[] {
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const f of answer.features ?? []) {
    const { name, at } = featureOf(f);
    if (name === "" || seen.has(name) || out.length === MAX_STATIONS) continue;
    seen.add(name);
    out.push({ name, latitude: at[1], longitude: at[0], km: kmBetween(near, at) });
  }
  return out;
}

/** What a Photon search is built from; tests pass a fake fetch. */
export interface PhotonOptions {
  url: string;
  fetch?: typeof fetch;
  log?: Log;
}

/**
 * Mode's stations or stops named like name within about 100 km of near, in the order Photon ranks
 * them (best match, then nearest), each name once. When the name finds nothing, it's searched again
 * without words like "Station".
 */
export async function photonStationSearch(
  options: PhotonOptions,
  mode: string,
  name: string,
  near: Spot,
  signal?: AbortSignal,
): Promise<Station[]> {
  if (!Object.hasOwn(PHOTON_TAGS, mode)) throw new NoKindError();
  const tags = PHOTON_TAGS[mode]!;
  const trimmed = name.trim();
  if (trimmed === "") throw new NoNameError();
  try {
    let answer = await askPhoton(options, photonQuery(tags, trimmed, near), trimmed, signal);
    if ((answer.features ?? []).length === 0 && placeName(trimmed) !== trimmed) {
      answer = await askPhoton(
        options,
        photonQuery(tags, placeName(trimmed), near),
        placeName(trimmed),
        signal,
      );
    }
    return photonStations(answer, near);
  } catch (error) {
    throw new PhotonError(error instanceof Error ? error.message : String(error));
  }
}

/** Runs one Photon search and reads its answer, logging how long it took. */
async function askPhoton(
  options: PhotonOptions,
  query: string,
  q: string,
  signal?: AbortSignal,
): Promise<PhotonAnswer> {
  const start = Date.now();
  const log = options.log ?? quietLog;
  try {
    const res = await (options.fetch ?? globalThis.fetch)(`${options.url}?${query}`, {
      headers: { "user-agent": USER_AGENT },
      signal: anySignal(signal, AbortSignal.timeout(PHOTON_TIMEOUT_MS)),
    });
    if (res.status !== 200) throw new Error(`it answered ${statusLine(res)}`);
    const answer = (await res.json()) as PhotonAnswer;
    log.info(
      { q, tookMs: Date.now() - start, found: (answer.features ?? []).length },
      "photon search",
    );
    return answer;
  } catch (error) {
    log.info({ q, tookMs: Date.now() - start, err: String(error) }, "photon search");
    throw error;
  }
}
