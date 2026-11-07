import { useEffect, useState } from "react";

/**
 * One feature of TRIPLINES.geo.json, which the pipeline's Commit bakes: a segment of a day's trip
 * line (a LineString with its `mode`), a place visited (a Point with `"feature": "visit"`), or an
 * area photos without an exact spot were taken in (a MultiPolygon with `"feature": "fence"`).
 */
interface TripMapFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { day: string; feature?: "visit" | "fence"; mode?: string; colour?: string };
}

/** TRIPLINES.geo.json: every day's lines, places visited and areas. */
export interface TripLinesMap {
  type: "FeatureCollection";
  features: TripMapFeature[];
}

/**
 * TRIPLINES.geo.json, loaded the first time the map draws trip lines, so pages that never do
 * don't carry it; undefined until then, or while `on` is false.
 */
export function useTripLinesMap(on: boolean): TripLinesMap | undefined {
  const [map, setMap] = useState<TripLinesMap>();
  useEffect(() => {
    if (!on || map) return;
    let current = true;
    void import("@/data/triplines/TRIPLINES.geo.json").then((file) => {
      if (current) setMap(file.default as TripLinesMap);
    });
    return () => {
      current = false;
    };
  }, [on, map]);
  return on ? map : undefined;
}

/** The map with only the features of days, such as the days of the photos the map draws. */
export function onDays(map: TripLinesMap, days: Set<string>): TripLinesMap {
  return { ...map, features: map.features.filter((f) => days.has(f.properties.day)) };
}
