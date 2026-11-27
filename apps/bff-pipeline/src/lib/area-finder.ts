import {
  type Area,
  areasOf,
  MAX_AREAS,
  type EntityData,
  isWikidataId,
  type NominatimPlace,
  relationOf,
} from "./areas.js";
import { Gate } from "./gate.js";
import { MemoCache } from "./memo.js";

/**
 * Looks up areas with an outline on OpenStreetMap's Nominatim search server
 * (https://nominatim.org/release-docs/latest/api/Search/), whose usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/) allows at most one request a second
 * from an application that names itself. A Wikidata item ID, such as Q1490, is looked up through
 * its OpenStreetMap relation ID (https://www.wikidata.org/wiki/Property:P402).
 */

/** OpenStreetMap's Nominatim server, used unless NOMINATIM_URL names another with the same paths. */
export const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";

/** Wikidata's server, used unless WIKIDATA_URL names another with the same paths. */
export const DEFAULT_WIKIDATA_URL = "https://www.wikidata.org";

/** Names the pipeline to the servers, as their policies ask. */
const USER_AGENT = "servenupphotos-pipeline (https://github.com/emilyeserven/servenupphotos)";

/** How long one request to a server may take. */
const REQUEST_TIMEOUT_MS = 15_000;

/** How far, in degrees (about 50 m), Nominatim may move an outline's points to keep it small. */
const SIMPLIFY = "0.0005";

/** Thrown for a Wikidata item with no OpenStreetMap relation ID, so no outline to look up. */
export class NoRelationError extends Error {
  constructor() {
    super("the Wikidata item has no OpenStreetMap relation (P402)");
  }
}

/** What an area finder is built from; tests pass a fake fetch and their own servers. */
export interface AreaFinderOptions {
  nominatimUrl: string;
  wikidataUrl: string;
  /** Spaces requests out, as the servers ask; one a second across both servers. */
  gate?: Gate;
  /** Keeps the areas already found, by query; a day, up to 100 searches, by default. */
  cache?: MemoCache<Area[]>;
  fetch?: typeof fetch;
}

/** Looks up areas by name or Wikidata ID, at most one request a second across both servers. */
export class AreaFinder {
  readonly #options: Required<AreaFinderOptions>;

  constructor(options: AreaFinderOptions) {
    this.#options = {
      gate: new Gate(1000),
      cache: new MemoCache<Area[]>(24 * 60 * 60 * 1000, 100),
      fetch: globalThis.fetch,
      ...options,
    };
  }

  /**
   * The areas with an outline that match query: a name, such as "Osaka Castle Park", or a Wikidata
   * item ID, such as Q1490. Rejects with NoRelationError for a Wikidata item without an
   * OpenStreetMap relation.
   */
  async find(query: string, signal?: AbortSignal): Promise<Area[]> {
    const key = query.trim();
    const kept = this.#options.cache.get(key);
    if (kept) return kept;
    const found = isWikidataId(key)
      ? await this.#wikidata(key, signal)
      : await this.#search(key, signal);
    this.#options.cache.put(key, found);
    return found;
  }

  /** The areas named query: one request to Nominatim. */
  #search(query: string, signal?: AbortSignal): Promise<Area[]> {
    return this.#nominatim("/search", { limit: String(MAX_AREAS), q: query }, signal);
  }

  /** The area of Wikidata item id, through its OpenStreetMap relation: two requests. */
  async #wikidata(id: string, signal?: AbortSignal): Promise<Area[]> {
    const address = `${this.#options.wikidataUrl}/wiki/Special:EntityData/${id}.json`;
    const relation = relationOf(await this.#get<EntityData>(address, signal), id);
    if (relation === "") throw new NoRelationError();
    return this.#nominatim("/lookup", { osm_ids: `R${relation}` }, signal);
  }

  /** Asks Nominatim's path with params and the places' outlines, keeping the answers that are areas. */
  async #nominatim(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Area[]> {
    const all = { ...params, format: "jsonv2", polygon_geojson: "1", polygon_threshold: SIMPLIFY };
    // In key order, as the Go backend asked, so Nominatim sees the same requests.
    const query = new URLSearchParams(Object.entries(all).toSorted(([a], [b]) => (a < b ? -1 : 1)));
    const places = await this.#get<unknown>(
      `${this.#options.nominatimUrl}${path}?${query}`,
      signal,
    );
    if (!Array.isArray(places)) throw new Error("Nominatim's answer isn't a list of places");
    return areasOf(places as NominatimPlace[]);
  }

  /** Waits its turn, asks for address and reads the JSON answer. */
  async #get<T>(address: string, signal?: AbortSignal): Promise<T> {
    await this.#options.gate.wait(signal);
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const res = await this.#options.fetch(address, {
      headers: { "user-agent": USER_AGENT },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) throw new Error(`the server answered ${`${res.status} ${res.statusText}`.trim()}`);
    return (await res.json()) as T;
  }
}

/** The address in the environment variable's value, without a trailing slash, or else fallback. */
export function serverUrl(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").replace(/\/$/, "");
  return trimmed === "" ? fallback : trimmed;
}
