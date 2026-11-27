import { NoRelationError } from "./area-finder.js";
import type { Area } from "./areas.js";
import { firstParam } from "./query.js";

/** How long one look-up may take, waiting its turn included. */
const AREA_SEARCH_TIMEOUT_MS = 28_000;

/** The longest search accepted, in bytes. */
const MAX_QUERY_BYTES = 200;

/** What `GET /api/areas` answers: its status code and JSON body. */
export interface AreaSearchAnswer {
  status: number;
  body: Area[] | { message: string };
}

/** Finds the areas for a search; AreaFinder's find, or a fake in tests. */
export type FindAreas = (query: string, signal: AbortSignal) => Promise<Area[]>;

/** The first value of the `q` query parameter, trimmed. */
export function searchOf(query: unknown): string {
  return firstParam(query, "q").trim();
}

/**
 * The answer to an area search for q: a name, such as "Osaka Castle Park", or a Wikidata item ID,
 * such as Q1490. A 400 for an empty or overlong search, a 404 for a Wikidata item with no
 * OpenStreetMap relation, and a 502 when the servers can't be asked.
 */
export async function answerAreaSearch(find: FindAreas, q: string): Promise<AreaSearchAnswer> {
  if (q === "" || Buffer.byteLength(q) > MAX_QUERY_BYTES) {
    return {
      status: 400,
      body: { message: "Give the area's name, or its Wikidata ID such as Q1490." },
    };
  }
  try {
    return { status: 200, body: await find(q, AbortSignal.timeout(AREA_SEARCH_TIMEOUT_MS)) };
  } catch (error) {
    if (error instanceof NoRelationError) {
      const message =
        "That Wikidata item has no OpenStreetMap relation (P402), so there's no outline to use. Try its name instead.";
      return { status: 404, body: { message } };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: 502,
      body: { message: `Couldn't look up the area on OpenStreetMap: ${reason}` },
    };
  }
}
