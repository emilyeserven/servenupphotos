import type { Spot } from "@/api/transit";
import type { TripPoint, TripTransitLine } from "@/api/trip-lines";
import type { TripLeg, TripLegRide } from "@/api/trips";

/** A track, each point [longitude, latitude]. */
type Path = [number, number][];

/** A station as [longitude, latitude]. */
function spotOf(p: TripPoint): Spot {
  return [p.longitude, p.latitude];
}

/** The leg's rides: its own, or one ride with its line when it changed none. */
export function ridesOf(leg: TripLeg): TripLegRide[] {
  return leg.rides ?? [{ line: leg.line, path: leg.path }];
}

/** Where each ride got on and off: the leg's ends with the stations changed at between them. */
export function rideEnds(rides: TripLegRide[], [from, to]: [Spot, Spot]): [Spot, Spot][] {
  const stops = [from, ...rides.flatMap((r) => (r.change ? [spotOf(r.change)] : [])), to];
  return rides.map((_, i) => [stops[i]!, stops[i + 1]!]);
}

/** Halfway between two spots, where a station changed at between them is looked for. */
export function midway([a, b]: [Spot, Spot]): Spot {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** The rides' lines' names, each once, joined: the combined route's name until one is typed. */
function joinedName(rides: TripLegRide[]): string {
  return [...new Set(rides.map((r) => r.line?.name ?? ""))].join(" / ");
}

/** The route the rides make together, under the name typed for it or else their joined names. */
function combinedLine(rides: TripLegRide[], name?: string): TripTransitLine {
  return { ...rides[0]!.line!, name: name ?? joinedName(rides) };
}

/**
 * The leg with these rides, kept as separate lines, or recombined into one route under its name
 * when it was combined already.
 */
export function withRides(leg: TripLeg, rides: TripLegRide[]): TripLeg {
  const { line, path: _path, rides: _rides, ...rest } = leg;
  if (rides.length < 2) return withOneRide(rest, rides[0]);
  const kept = { ...rest, rides };
  return combinedName(leg, line) === undefined ? kept : withCombined(kept, line?.name);
}

/** The name of the route the leg's rides were combined into; none when they weren't. */
function combinedName(leg: TripLeg, line?: TripTransitLine): string | undefined {
  return leg.rides && line?.name;
}

/** Whether every ride has its line, so they can be combined into one route. */
export function allPicked(rides: TripLegRide[]): boolean {
  return rides.length > 1 && rides.every((r) => r.line);
}

/** The leg with its rides combined into one route along their joined tracks, once each has a line. */
export function withCombined(leg: TripLeg & { rides: TripLegRide[] }, name?: string): TripLeg {
  const { rides } = leg;
  if (!allPicked(rides)) return leg;
  const path: Path = rides.flatMap((r) => r.path ?? []);
  return { ...leg, line: combinedLine(rides, name), path };
}

/** The leg with its rides drawn as separate lines again, its combined route taken off. */
export function withSeparateRides({ line: _line, path: _path, ...leg }: TripLeg): TripLeg {
  return leg;
}

/** The leg riding one line, or none. */
function withOneRide(leg: TripLeg, ride?: TripLegRide): TripLeg {
  if (!ride?.line) return leg;
  return { ...leg, line: ride.line, path: ride.path };
}

/** The rides with a change at station on the way of the last one, which is then picked again. */
export function withChange(rides: TripLegRide[], station: TripPoint): TripLegRide[] {
  return [...rides.slice(0, -1), { change: station }, {}];
}

/** The rides without the change after ride i, which joins it to the next to be picked again. */
export function withoutChange(rides: TripLegRide[], i: number): TripLegRide[] {
  const next = rides[i + 1]?.change;
  return [...rides.slice(0, i), next ? { change: next } : {}, ...rides.slice(i + 2)];
}

/** The rides with ride i on line, along path, or with no line when there is none. */
export function withRideLine(
  rides: TripLegRide[],
  i: number,
  line?: TripTransitLine,
  path?: Path,
): TripLegRide[] {
  const change = rides[i]!.change;
  return rides.map((r, j) => (j === i ? { ...(change && { change }), line, path } : r));
}

/**
 * The rides of a leg that changed lines without combining them, each drawn as its own line; none
 * when it has a route, changed no lines, or a ride has no track yet.
 */
export function separateRides(leg: TripLeg): (TripLegRide & { path: Path })[] | undefined {
  const rides = uncombined(leg);
  const drawn = rides.filter(hasTrack);
  return drawn.length > 0 && drawn.length === rides.length ? drawn : undefined;
}

/** The rides of a leg that changed lines, each with its line, when they aren't combined; else none. */
function uncombined(leg: TripLeg): TripLegRide[] {
  if (leg.line || !allPicked(leg.rides ?? [])) return [];
  return leg.rides!;
}

/** Whether a ride has a track to draw. */
function hasTrack(ride: TripLegRide): ride is TripLegRide & { path: Path } {
  return (ride.path?.length ?? 0) >= 2;
}
