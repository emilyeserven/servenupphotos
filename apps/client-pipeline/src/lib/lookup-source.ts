import type { LookupSource, RouteSource } from "@/api/transit";

/** The sources that only have railways: Japan's rail map and the OpenStreetMap ones. */
const RAIL_MAPS: ReadonlySet<RouteSource> = new Set(["mlit", "osmrail"]);

/**
 * Where a hop or leg of kind is looked up: the source picked, or, while a rail map is picked
 * (which only has railways), OpenStreetMap's bus map for a bus and OpenStreetMap's Overpass servers
 * for a ferry.
 */
export function lookupSource(source: RouteSource, kind: string | undefined): LookupSource {
  if (!RAIL_MAPS.has(source) || kind === undefined || kind === "train" || kind === "subway") {
    return source;
  }
  return kind === "bus" ? "osmbus" : "overpass";
}
