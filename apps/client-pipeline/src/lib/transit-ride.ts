import type { HopAsk, Spot, TransitStop } from "@/api/transit";
import type { TripPoint, TripTransitLine } from "@/api/trip-lines";

/** A hop's ride: the line, its track, and the stations it got on and off at. */
export interface Ride {
  line: TripTransitLine;
  path: Spot[];
  board?: TripPoint;
  alight?: TripPoint;
}

/** Where a hop got on and off its line: a station, null at the photo, or left out for the nearest. */
export interface Stations {
  board?: TripPoint | null;
  alight?: TripPoint | null;
}

/** Where the ride got on and off: a station, or undefined at the photo. */
type Ridden = Pick<Ride, "board" | "alight">;

/** A station as a spot on the trip line, labelled with its name. */
export function stopPoint(stop: TransitStop): TripPoint {
  return { latitude: stop.latitude, longitude: stop.longitude, label: stop.name };
}

/** How far apart a and b are, in degrees with longitude scaled to the latitude. */
function apart(a: Spot, b: Spot): number {
  const scale = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * scale, a[1] - b[1]);
}

/** The point as [longitude, latitude]. */
function spotOf(p: TripPoint): Spot {
  return [p.longitude, p.latitude];
}

/** The stop nearest the spot, as a trip line point; none with no stops. */
function nearestStop(stops: TransitStop[], spot: Spot): TripPoint | undefined {
  const ranked = stops.toSorted((a, b) => apart(spotOf(a), spot) - apart(spotOf(b), spot));
  return ranked[0] && stopPoint(ranked[0]);
}

/** The station chosen: the stop nearest spot when none was, or none (at the photo) for null. */
function stationOr(
  chosen: TripPoint | null | undefined,
  stops: TransitStop[],
  spot: Spot,
): TripPoint | undefined {
  return chosen === undefined ? nearestStop(stops, spot) : (chosen ?? undefined);
}

/** The stations chosen, with the stop nearest each photo where none was. */
export function stationsFor(stops: TransitStop[], ask: HopAsk, chosen: Stations): Ridden {
  return {
    board: stationOr(chosen.board, stops, ask.from),
    alight: stationOr(chosen.alight, stops, ask.to),
  };
}

/** Where the ride's track runs between: the stations, or the photos where there are none. */
export function rideSpots(ask: HopAsk, { board, alight }: Ridden): [Spot, Spot] {
  return [board ? spotOf(board) : ask.from, alight ? spotOf(alight) : ask.to];
}

/** Whether the lines found are all one line (its directions, say), so it can be picked alone. */
export function oneLine(lines: { name: string; ref?: string }[] = []): boolean {
  return new Set(lines.map((l) => `${l.ref}|${l.name}`)).size === 1;
}
