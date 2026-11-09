import type { GeoBounds } from "@portfolio/lib/fit-view";

/**
 * How far apart two days' lines can be and still share a map, in degrees: about 50 km, so a city
 * and its day trips draw together but two cities on one trip each get their own.
 */
const NEAR = 0.5;

/** The days drawn on one map and the box around their lines. */
export interface RoutePlace {
  days: string[];
  bounds: GeoBounds;
}

/** Whether two boxes come within NEAR of each other. */
function isNear(a: GeoBounds, b: GeoBounds): boolean {
  const apartX = Math.max(a.west - b.east, b.west - a.east);
  const apartY = Math.max(a.south - b.north, b.south - a.north);
  return apartX <= NEAR && apartY <= NEAR;
}

/** The box around both. */
function joined(a: GeoBounds, b: GeoBounds): GeoBounds {
  return {
    west: Math.min(a.west, b.west),
    east: Math.max(a.east, b.east),
    south: Math.min(a.south, b.south),
    north: Math.max(a.north, b.north),
  };
}

/** The place with the day's line added. */
function withDay(place: RoutePlace, day: string, bounds: GeoBounds): RoutePlace {
  return { days: [...place.days, day], bounds: joined(place.bounds, bounds) };
}

/**
 * The days, in order, grouped by where their lines are: each day joins the first place its line
 * comes near, or starts a new one. Days without a box are left out.
 */
export function routePlaces(days: string[], boundsOf: (day: string) => GeoBounds | undefined) {
  const places: RoutePlace[] = [];
  for (const day of days) {
    const bounds = boundsOf(day);
    if (!bounds) continue;
    const i = places.findIndex((place) => isNear(place.bounds, bounds));
    if (i === -1) places.push({ days: [day], bounds });
    else places[i] = withDay(places[i]!, day, bounds);
  }
  return places;
}
