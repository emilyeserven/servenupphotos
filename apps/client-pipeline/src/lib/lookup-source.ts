import type { RouteSource } from "@/api/transit";

/** The sources that only have railways: Japan's rail map and the OpenStreetMap ones. */
const RAIL_MAPS: ReadonlySet<RouteSource> = new Set(["mlit", "osmrail"]);

/**
 * Where a hop of kind is looked up: the source picked, or OpenStreetMap for a bus or ferry while a
 * rail map is picked, since those only have railways.
 */
export function lookupSource(source: RouteSource, kind: string | undefined): RouteSource {
  const rail = kind === "train" || kind === "subway";
  return RAIL_MAPS.has(source) && kind !== undefined && !rail ? "overpass" : source;
}
