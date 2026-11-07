import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { PlacedPhoto } from "@/lib/map-photos";
import { withLanes } from "@/lib/trip-lanes";

/**
 * One feature of TRIPLINES.geo.json, which the pipeline's Commit bakes: a segment of a day's trip
 * line (a LineString with its `mode`), a place visited (a Point with `"feature": "visit"`), or an
 * area photos without an exact spot were taken in (a MultiPolygon with `"feature": "fence"`).
 */
export interface TripMapFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: {
    day: string;
    feature?: "visit" | "fence";
    mode?: string;
    colour?: string;
    /** The Trip a leg between days is part of, and the day it arrived. */
    trip?: string;
    arrive?: string;
    /** The lane a line that runs over an earlier one is drawn in, to the side of it. */
    lane?: number;
  };
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

/** Whether a feature belongs to one of the days: its own, or for a Trip's leg, the day it arrived. */
function isOnDays({ properties }: TripMapFeature, days: Set<string>): boolean {
  return days.has(properties.day) || days.has(properties.arrive ?? "");
}

/**
 * The map with only the features of days, such as the days of the photos the map draws, each line
 * that runs over an earlier one in a lane of its own.
 */
function onDays(map: TripLinesMap, days: Set<string>): TripLinesMap {
  return { ...map, features: withLanes(map.features.filter((f) => isOnDays(f, days))) };
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
