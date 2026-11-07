import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { PlacedPhoto } from "@/lib/map-photos";

/**
 * One feature of TRIPLINES.geo.json, which the pipeline's Commit bakes: a segment of a day's trip
 * line (a LineString with its `mode`), a place visited (a Point with `"feature": "visit"`), or an
 * area photos without an exact spot were taken in (a MultiPolygon with `"feature": "fence"`).
 */
export interface TripMapFeature {
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
function onDays(map: TripLinesMap, days: Set<string>): TripLinesMap {
  return { ...map, features: map.features.filter((f) => days.has(f.properties.day)) };
}

/** The days the photos were taken, as TRIPLINES.geo.json writes them. */
function daysOf(photos: PlacedPhoto[]): Set<string> {
  return new Set(photos.map((p) => format(p.takenAt, "yyyy-MM-dd")));
}

/**
 * The trip lines of the days the photos were taken, which the map draws and its key explains;
 * undefined while `show` is off or before TRIPLINES.geo.json has loaded.
 */
export function useShownTripLines(photos: PlacedPhoto[], show: boolean): TripLinesMap | undefined {
  const map = useTripLinesMap(show);
  return useMemo(() => map && onDays(map, daysOf(photos)), [map, photos]);
}
