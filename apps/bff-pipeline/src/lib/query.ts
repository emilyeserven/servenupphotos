import { STATUS_CODES } from "node:http";

/** The first value of the query parameter name, as Fastify parses the query; "" when there's none. */
export function firstParam(query: unknown, name: string): string {
  const value = (query as Record<string, unknown> | undefined)?.[name];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : "";
}

/**
 * A query string from entries, sorted by key with a key's values kept in order, as the Go backend
 * wrote its requests, so the servers see the same requests (and answer them from the same caches).
 */
export function sortedQuery(entries: [string, string][]): string {
  const sorted = entries.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.map(([k, v]) => `${queryEscape(k)}=${queryEscape(v)}`).join("&");
}

/** s escaped byte by byte, keeping only the characters Go's escaping keeps. */
function escapeBytes(s: string, keep: RegExp, space: string): string {
  let out = "";
  for (const byte of Buffer.from(s, "utf8")) {
    const c = String.fromCharCode(byte);
    if (c === " ") out += space;
    else out += keep.test(c) ? c : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** s escaped for a query string as Go's `url.QueryEscape` escapes it: letters, digits and `-_.~` kept, a space as `+`. */
export function queryEscape(s: string): string {
  return escapeBytes(s, /[A-Za-z0-9\-_.~]/, "+");
}

/** A response's status line, such as "502 Bad Gateway", with the standard reason when it sent none. */
export function statusLine(res: Response): string {
  return `${res.status} ${res.statusText || STATUS_CODES[res.status] || ""}`.trim();
}

/**
 * n with exactly places decimal places, as Go's `%.Nf` writes it: rounded from n's exact value, a
 * tie to the even digit (where JavaScript's toFixed rounds it up), and -0 with its sign.
 */
export function goFixed(n: number, places: number): string {
  const sign = n < 0 || Object.is(n, -0) ? "-" : "";
  const abs = Math.abs(n);
  // A tie is a multiple of 2^-(places + 1), and the doubles beside one a coordinate's size are far
  // more than 10^-20 away, so 20 places tell a tie from its neighbours.
  const exact = abs.toFixed(20);
  const point = exact.indexOf(".");
  const rest = exact.slice(point + 1 + places);
  if (!/^50*$/.test(rest)) return sign + abs.toFixed(places);
  const kept = exact.slice(0, point + 1 + places).replace(/\.$/, "");
  // An odd digit rounds up on a tie, as toFixed rounds every tie.
  return sign + (Number(kept.at(-1)) % 2 === 0 ? kept : abs.toFixed(places));
}

/** n with exactly six decimal places, as the Go backend's `%f` wrote coordinates into requests. */
export function sixPlaces(n: number): string {
  return goFixed(n, 6);
}

/** The signals combined: aborted as soon as any of them is; the ones left out are ignored. */
export function anySignal(...signals: (AbortSignal | undefined)[]): AbortSignal {
  return AbortSignal.any(signals.filter((s): s is AbortSignal => s !== undefined));
}

/** Whether the signal was aborted because its time ran out, rather than by a caller giving up. */
export function timedOut(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true && (signal.reason as Error | undefined)?.name === "TimeoutError";
}

/**
 * s escaped for a URL path segment, byte by byte, keeping what Go's `url.PathEscape` keeps: letters,
 * digits, `-_.~` and `$&+:=@`.
 */
export function pathEscape(s: string): string {
  return escapeBytes(s, /[A-Za-z0-9\-_.~$&+:=@]/, "%20");
}

/** Writes structured lines to the terminal, as Fastify's logger does; a fake in tests. */
export interface Log {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
}

/** A Log that writes nothing. */
export const quietLog: Log = { info() {}, warn() {} };
