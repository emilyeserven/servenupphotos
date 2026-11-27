import { BusyError, SlowError, StatusError } from "./overpass.js";
import { PhotonError } from "./photon.js";
import { firstParam } from "./query.js";
import { NoKindError, NoNameError, NoTrackError, type Spot } from "./transit-types.js";
import { NoTransitlandKeyError, SOURCE_TRANSITLAND, TransitlandError } from "./transitland.js";

/**
 * What the transit routes answer: reading their query, and turning a look-up's result or failure
 * into a status and a JSON body, with the same messages the Go backend gave.
 */

/** How long one look-up may take, waiting its turn and trying the mirrors included. */
export const TRANSIT_TIMEOUT_MS = 100_000;

/** A status code and JSON body to answer with. */
export interface Answer {
  status: number;
  body: unknown;
}

/** An error answer, as the backend writes them. */
function message(status: number, text: string): Answer {
  return { status, body: { message: text } };
}

/**
 * The rail and bus map sources, whose maps are downloaded and read by the Go backend: a request for
 * one is relayed there, as is `GET /transit/downloads`.
 */
const MAP_SOURCES = new Set(["mlit", "osmrail", "osmbus"]);

/** Whether the request asks a rail or bus map, which the Go backend answers. */
export function asksMap(query: unknown): boolean {
  return MAP_SOURCES.has(firstParam(query, "source"));
}

/** Where the request asks for lines: "transitland", or else "" for OpenStreetMap's Overpass servers. */
export function onlineSource(query: unknown): string {
  return firstParam(query, "source") === SOURCE_TRANSITLAND ? SOURCE_TRANSITLAND : "";
}

/** What a lines look-up of source searched, in a sentence for the page. */
export function searched(source: string): string {
  return source === SOURCE_TRANSITLAND
    ? "Transitland, the timetables transit agencies publish"
    : "OpenStreetMap's Overpass servers, asked live";
}

/** A number as Go's `strconv.ParseFloat` reads a decimal one, or undefined; no NaN or infinities. */
function parseNumber(s: string): number | undefined {
  const t = s.trim();
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) ? Number(t) : undefined;
}

/** "longitude,latitude" as a spot, or undefined when it isn't one on the globe. */
export function parseSpot(s: string): Spot | undefined {
  const comma = s.indexOf(",");
  if (comma < 0) return undefined;
  const x = parseNumber(s.slice(0, comma));
  const y = parseNumber(s.slice(comma + 1));
  if (x === undefined || y === undefined || x < -180 || x > 180 || y < -90 || y > 90)
    return undefined;
  return [x, y];
}

/** The ?from= and ?to= spots, or the 400 to answer when either isn't one. */
export function spotsOf(query: unknown): { from: Spot; to: Spot } | Answer {
  const from = parseSpot(firstParam(query, "from"));
  const to = parseSpot(firstParam(query, "to"));
  if (!from || !to) return message(400, "Give from and to as longitude,latitude.");
  return { from, to };
}

/** The ?near= spot, or the 400 to answer when it isn't one. */
export function nearOf(query: unknown): Spot | Answer {
  return (
    parseSpot(firstParam(query, "near")) ??
    message(400, "Give near as longitude,latitude: a spot on the day the station is looked for on.")
  );
}

/** The path's line ID, or the 400 to answer when it isn't one. */
export function lineIdOf(id: string): number | Answer {
  const n = /^[+-]?\d+$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0)
    return message(400, "Give the line's OpenStreetMap, Transitland or rail map ID.");
  return n;
}

/** Whether a parsed value is an answer to send, rather than the value. */
export function isAnswer(v: unknown): v is Answer {
  return typeof v === "object" && v !== null && "status" in v && "body" in v;
}

/** A server's failure in a few words, such as "answered 502 Bad Gateway" or "took too long to answer". */
function statusOf(error: Error): string {
  if (error instanceof StatusError) return `answered ${error.status}`;
  if (error instanceof SlowError) return "took too long to answer";
  return `failed: ${error.message}`;
}

/**
 * The answer to a failed look-up of what, such as "look up lines". When every server was busy it
 * says so and asks to try again later, since that's the servers' load and not the photos.
 */
export function failedLookup(what: string, error: unknown): Answer {
  if (error instanceof NoTransitlandKeyError) {
    return message(
      503,
      "Transitland needs an API key: get a free one at transit.land, add TRANSITLAND_API_KEY=<key> to the repo's .env, and restart the BFF. Or look it up on OpenStreetMap instead.",
    );
  }
  if (error instanceof TransitlandError)
    return message(502, `${error.message}. Try again, or look it up on OpenStreetMap instead.`);
  if (error instanceof BusyError) {
    return message(
      503,
      `OpenStreetMap's line servers are busy right now, so we couldn't ${what} (tried ${error.tries} times on ${error.servers} servers; the last, ${error.server}, ${statusOf(error.last)}). Try again in a minute.`,
    );
  }
  return message(
    502,
    `Couldn't ${what} on OpenStreetMap: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** The answer to a lines look-up. */
export function linesAnswer(lines: unknown, error?: unknown): Answer {
  if (error instanceof NoKindError) {
    return message(
      400,
      "Pick whether the hop was a train, subway, bus or ferry to find its lines, or name the line yourself.",
    );
  }
  return error === undefined ? { status: 200, body: lines } : failedLookup("look up lines", error);
}

/** The answer to a station search. */
export function stationsAnswer(stations: unknown, error?: unknown): Answer {
  if (error instanceof NoKindError)
    return message(400, "Stations can be looked up for a train, subway, bus or ferry.");
  if (error instanceof NoNameError) return message(400, "Type the station's name to look it up.");
  if (error instanceof PhotonError)
    return message(502, `${error.message}. Try again, or search with Overpass instead.`);
  return error === undefined
    ? { status: 200, body: stations }
    : failedLookup("look up stations", error);
}

/** The answer to a line's stops. */
export function stopsAnswer(stops: unknown, error?: unknown): Answer {
  return error === undefined
    ? { status: 200, body: stops }
    : failedLookup("get the line's stops", error);
}

/** The answer to a line's track: the path, or why it couldn't be followed. */
export function trackAnswer(path: Spot[] | undefined, error?: unknown): Answer {
  if (error instanceof NoTrackError)
    return message(
      422,
      "That line's mapped track doesn't join those two spots. Try another line or direction.",
    );
  return error === undefined
    ? { status: 200, body: { path } }
    : failedLookup("get the line's track", error);
}

/** Runs a look-up and answers with answer(result) or answer(undefined, its error). */
export async function settle<T>(
  lookUp: () => Promise<T>,
  answer: (value: T | undefined, error?: unknown) => Answer,
): Promise<Answer> {
  try {
    return answer(await lookUp());
  } catch (error) {
    return answer(undefined, error);
  }
}
