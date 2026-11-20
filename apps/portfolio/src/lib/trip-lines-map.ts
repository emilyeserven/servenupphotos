import { useEffect, useMemo, useState } from "react";
import type { PlacedPhoto } from "@/lib/map-photos";
import { withoutTrips } from "@/lib/map-trips";
import { withLanes } from "@/lib/trip-lanes";
import { isoDate } from "@portfolio/lib/dates";

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
    /** The name of the transit line a hop rode; none when none was picked. */
    line?: string;
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

/** The map with only the features of days, such as the days of the photos the map draws. */
function onDays(map: TripLinesMap, days: Set<string>): TripLinesMap {
  return { ...map, features: map.features.filter((f) => isOnDays(f, days)) };
}

/** The days the photos were taken, as TRIPLINES.geo.json writes them. */
function daysOf(photos: PlacedPhoto[]): Set<string> {
  return new Set(photos.map((p) => isoDate(p.takenAt)));
}

/**
 * The trip lines of the days the photos were taken, which the map draws and its key explains, less
 * those of the `hidden` Trips (turned off in the Places menu's Trip tab), each line that runs over an
 * earlier one in a lane of its own; undefined while `show` is off or before TRIPLINES.geo.json has
 * loaded.
 */
export function useShownTripLines(
  photos: PlacedPhoto[],
  show: boolean,
  hidden: string[] = [],
): TripLinesMap | undefined {
  const map = useTripLinesMap(show);
  const hiddenKey = hidden.join(",");
  return useMemo(() => {
    if (!map) return undefined;
    const shown = withoutTrips(onDays(map, daysOf(photos)), hiddenKey ? hiddenKey.split(",") : []);
    return { ...shown, features: withLanes(shown.features) };
  }, [map, photos, hiddenKey]);
}

/**
 * The Trips with trip lines on the days the photos were taken, for the Places menu's Trip tab, while
 * `on`; undefined until TRIPLINES.geo.json has loaded.
 */
export function useTripLinesOnDays(photos: PlacedPhoto[], on: boolean): TripLinesMap | undefined {
  const map = useTripLinesMap(on);
  return useMemo(() => map && onDays(map, daysOf(photos)), [map, photos]);
}
