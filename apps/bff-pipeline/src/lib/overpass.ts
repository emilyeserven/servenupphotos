import { Gate } from "./gate.js";
import { MemoCache } from "./memo.js";
import { anySignal, type Log, queryEscape, quietLog, statusLine, timedOut } from "./query.js";
import { USER_AGENT } from "./transit-types.js";

/**
 * Asks OpenStreetMap's Overpass API servers (https://wiki.openstreetmap.org/wiki/Overpass_API),
 * by default the public overpass-api.de, which asks for light use: requests are spaced a second
 * apart, a busy or down server is followed by the next public mirror after a short wait, and each
 * answer is kept for a day. OVERPASS_URL, a comma-separated list, points it at other servers.
 */

/**
 * The public Overpass servers asked, in order: the main one, then mirrors that hold the whole planet
 * (https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
 */
const DEFAULT_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * What every query starts with: JSON, and how long the server may run it, 20s, which a loaded server
 * is also less likely to turn away (https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#timeout:).
 */
export const SERVER_TIMEOUT = "[out:json][timeout:20];";

/** How long one server gets to answer before the next is tried: its own 20s plus a busy server's wait. */
const TRY_TIMEOUT_MS = 40_000;

/** How many times each server is tried. */
const ROUNDS = 2;

/** One OpenStreetMap element in an Overpass answer. */
export interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: OsmMember[];
  /** A node's spot. */
  lat?: number;
  lon?: number;
  /** A way's or relation's middle, when asked for with "out center". */
  center?: { lat: number; lon: number };
}

/** One member of a route relation, with its geometry when asked for with "out geom". */
export interface OsmMember {
  type: string;
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

/** A server's answer that isn't Overpass JSON, as a busy server sometimes sends. */
const UNREADABLE = "the Overpass server's answer couldn't be read";

/** A server that didn't answer within its try, or before the look-up ran out of time. */
export class SlowError extends Error {
  constructor() {
    super("the Overpass server didn't answer in time");
  }
}

/** A server's answer other than 200 OK, such as 429 when asked too often or 504 when overloaded. */
export class StatusError extends Error {
  /** The status line, such as "502 Bad Gateway". */
  constructor(
    readonly code: number,
    readonly status: string,
  ) {
    super(`the Overpass server answered ${status}`);
  }
}

/** Every server was tried and none answered. */
export class BusyError extends Error {
  /**
   * tries is how many requests were made, servers how many servers were asked, server the host of the
   * last one tried, such as "overpass-api.de", and last its failure.
   */
  constructor(
    readonly tries: number,
    readonly servers: number,
    readonly server: string,
    readonly last: Error,
  ) {
    super(`no Overpass server answered; ${server} said: ${last.message}`);
  }
}

/** The comma-separated addresses in list, or else the public servers. */
export function overpassUrls(list: string | undefined): string[] {
  const urls = (list ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u !== "");
  return urls.length > 0 ? urls : DEFAULT_OVERPASS_URLS;
}

/** What an Overpass client is built from; tests pass fakes. */
export interface OverpassOptions {
  urls: string[];
  /** How long to wait before each try after the first, the last repeating; [1s, 3s] by default. */
  waitsMs?: number[];
  gate?: Gate;
  fetch?: typeof fetch;
  log?: Log;
}

/** Runs Overpass QL queries, at most one request a second, trying the next server when one is busy or down. */
export class OverpassClient {
  readonly #cache = new MemoCache<OsmElement[]>(24 * 60 * 60 * 1000, 200);
  readonly #urls: string[];
  readonly #waitsMs: number[];
  readonly #gate: Gate;
  readonly #fetch: typeof fetch;
  readonly #log: Log;

  constructor(options: OverpassOptions) {
    this.#urls = options.urls;
    this.#waitsMs = options.waitsMs ?? [1000, 3000];
    this.#gate = options.gate ?? new Gate(1000);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#log = options.log ?? quietLog;
  }

  /** Runs ql and reads its elements, from the cache when it was asked before. signal bounds the whole look-up. */
  async query(ql: string, signal?: AbortSignal): Promise<OsmElement[]> {
    const kept = this.#cache.get(ql);
    if (kept) {
      this.#log.info({ elements: kept.length }, "overpass answer from memory");
      return kept;
    }
    this.#log.info({ ql }, "overpass query");
    const elements = await this.#ask(ql, signal);
    this.#cache.put(ql, elements);
    return elements;
  }

  /**
   * Runs ql on each server in turn, ROUNDS times over, waiting a little longer before each try, until
   * one answers. A query the server turns down as wrong isn't tried again, and running out of time
   * after a try counts as every server being busy, since it's their load and not the query.
   */
  async #ask(ql: string, signal?: AbortSignal): Promise<OsmElement[]> {
    let busy: BusyError | undefined;
    for (let i = 0; i < ROUNDS * this.#urls.length; i++) {
      try {
        await this.#pause(i, signal);
      } catch (error) {
        throw outOfTime(signal, busy, error);
      }
      const base = this.#urls[i % this.#urls.length]!;
      try {
        return await this.#timedAsk(base, ql, i + 1, signal);
      } catch (error) {
        busy = new BusyError(i + 1, this.#urls.length, host(base), asError(error));
        if (!worthRetrying(signal, error)) throw outOfTime(signal, busy, error);
      }
    }
    throw busy;
  }

  /** askOnce, logging which try asked which server, how long it took and what it answered. */
  async #timedAsk(
    base: string,
    ql: string,
    attempt: number,
    signal?: AbortSignal,
  ): Promise<OsmElement[]> {
    const start = Date.now();
    try {
      const elements = await this.#askOnce(base, ql, signal);
      this.#log.info(
        { server: host(base), try: attempt, tookMs: Date.now() - start, elements: elements.length },
        "overpass answered",
      );
      return elements;
    } catch (error) {
      this.#log.warn(
        {
          server: host(base),
          try: attempt,
          tookMs: Date.now() - start,
          err: asError(error).message,
        },
        "overpass try failed",
      );
      throw error;
    }
  }

  /** Posts ql to the server at base and reads its elements. */
  async #askOnce(base: string, ql: string, signal?: AbortSignal): Promise<OsmElement[]> {
    await this.#gate.wait(signal);
    const attempt = anySignal(signal, AbortSignal.timeout(TRY_TIMEOUT_MS));
    let res: Response;
    try {
      res = await this.#fetch(base, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
        body: `data=${queryEscape(ql)}`,
        signal: attempt,
      });
    } catch (error) {
      throw slowOr(attempt, error);
    }
    if (res.status !== 200) throw new StatusError(res.status, statusLine(res));
    try {
      const answer = (await res.json()) as { elements?: OsmElement[] };
      return answer.elements ?? [];
    } catch {
      throw slowOr(attempt, new Error(UNREADABLE));
    }
  }

  /** Waits before try i (counting from 0): not at all before the first, then by the waits, until signal aborts. */
  async #pause(i: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (i === 0 || this.#waitsMs.length === 0) return;
    const ms = this.#waitsMs[Math.min(i - 1, this.#waitsMs.length - 1)]!;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }
}

/** A SlowError when the try ran out of time, or else error. */
function slowOr(attempt: AbortSignal, error: unknown): unknown {
  return timedOut(attempt) ? new SlowError() : error;
}

/** busy when the look-up ran out of time after at least one try, or else error, such as a query turned down as wrong. */
function outOfTime(
  signal: AbortSignal | undefined,
  busy: BusyError | undefined,
  error: unknown,
): unknown {
  return busy && timedOut(signal) ? busy : error;
}

/** Whether another server might answer: not once the look-up has run out of time, or for a status that says the query is wrong. */
function worthRetrying(signal: AbortSignal | undefined, error: unknown): boolean {
  if (signal?.aborted) return false;
  if (error instanceof StatusError) return error.code === 429 || error.code >= 500;
  return true;
}

/** base's host name, such as "overpass-api.de", or base itself. */
function host(base: string): string {
  try {
    return new URL(base).host || base;
  } catch {
    return base;
  }
}

/** error as an Error, for the messages that quote it. */
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
