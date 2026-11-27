/**
 * What the transit look-ups answer (lines, stops and stations a trip line's hop can ride) and the
 * errors they fail with, shared by the Overpass, Transitland and Photon look-ups.
 */

/** A spot as [longitude, latitude]. */
export type Spot = [number, number];

/** One transit line: usually one direction of one route, such as the Midosuji Line toward Esaka. */
export interface Line {
  /** The route relation's OpenStreetMap ID, or the Transitland route's ID. */
  id: number;
  /** The line's name, such as "Midosuji Line: Nakamozu → Esaka". */
  name: string;
  /** Its short number or letter, such as "M"; left out when none. */
  ref?: string;
  /** The line's color as a hex code, such as "#e5171f" (OpenStreetMap's `colour` tag); left out when none. */
  colour?: string;
  /** OpenStreetMap's route value, such as "subway". */
  kind: string;
  /** Where the line starts; left out when not mapped. Transitland's lines give their agency. */
  from?: string;
  /** Where the line ends; left out when not mapped. */
  to?: string;
  /** Where the line was found: left out for OpenStreetMap, "transitland" for Transitland. */
  source?: string;
}

/** A station or stop on a line, where a hop can get on or off. */
export interface Stop {
  /** The stop's name, such as "Namba"; "Stop 3" when it has none. */
  name: string;
  latitude: number;
  longitude: number;
}

/** A station or stop found by name, such as "Hakata". */
export interface Station {
  /** Its name, such as "博多". */
  name: string;
  /** Its English name; left out when none or the same as name. */
  nameEn?: string;
  latitude: number;
  longitude: number;
  /** How far it is from the spot it was looked for near, in km to one decimal place. */
  km: number;
}

/** How far, in meters, a line's track can pass from a spot and still count as serving it. */
export const NEAR_M = 500;

/** The most lines a look-up answers. */
const MAX_LINES = 40;

/** The most stations a station search answers. */
export const MAX_STATIONS = 15;

/** The pipeline's name, sent to every transit server. */
export const USER_AGENT = "servenupphotos-pipeline";

/** Thrown for a way of travelling with no mapped lines, such as a walk, or one not picked yet. */
export class NoKindError extends Error {
  constructor() {
    super("no transit lines for this way of travelling");
  }
}

/** Thrown when a station search has no name to look for. */
export class NoNameError extends Error {
  constructor() {
    super("no station name to look for");
  }
}

/** Thrown when the line's mapped track doesn't join the two spots, or the line has no track. */
export class NoTrackError extends Error {
  constructor() {
    super("couldn't follow that line between those spots");
  }
}

/** Lines sorted by number, then name, then ID, kept to MAX_LINES. */
export function sortLines(lines: Line[]): Line[] {
  const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);
  return lines
    .toSorted(
      (a, b) => compare(a.ref ?? "", b.ref ?? "") || compare(a.name, b.name) || compare(a.id, b.id),
    )
    .slice(0, MAX_LINES);
}

/** The first of values that isn't empty, or "". */
export function firstOf(...values: (string | undefined)[]): string {
  return values.find((v) => v !== undefined && v !== "") ?? "";
}

/** value, or undefined when it's empty, for a field left out of the JSON when empty. */
export function orNone(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

/**
 * How far apart two spots are along the Earth's surface, in km, to one decimal place.
 */
export function kmBetween(a: Spot, b: Spot): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
