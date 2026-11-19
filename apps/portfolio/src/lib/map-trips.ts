import { allTimelineLabels, type TimelineLabel } from "@/lib/timeline-labels";
import type { TripLinesMap, TripMapFeature } from "@/lib/trip-lines-map";

/** The ID the map's Trip tab gives the trip lines of days in no Trip. */
export const NO_TRIP = "no-trip";

/** A Trip whose lines the map can draw, as the Places menu's Trip tab lists it. */
export interface MapTrip {
  /** The Trip's ID from TIMELINE.json, or `NO_TRIP` for the days in none. */
  id: string;
  /** The Trip's name, or "Days in no trip". */
  name: string;
  /** Its first and last days with trip lines on the map, such as "2026-09-22". */
  start: string;
  end: string;
  /** How many of its days have trip lines on the map. */
  days: number;
}

/**
 * The Trip a trip line feature belongs to: a leg between days names its own, and any other is the
 * Trip that covers its day; `NO_TRIP` when none does.
 */
export function tripOf(feature: TripMapFeature, trips: TimelineLabel[]): string {
  const { trip, day } = feature.properties;
  if (trip) return trip;
  return trips.find(({ start, end }) => start <= day && day <= end)?.id ?? NO_TRIP;
}

/**
 * The Trips with trip lines in the map, newest first, then the days in no Trip when any have
 * lines.
 */
export function mapTrips(
  map: TripLinesMap,
  trips: TimelineLabel[] = allTimelineLabels(),
): MapTrip[] {
  const days = new Map<string, Set<string>>();
  for (const feature of map.features) {
    const id = tripOf(feature, trips);
    days.set(id, (days.get(id) ?? new Set()).add(feature.properties.day));
  }
  const listed = [...days].map(([id, its]) => mapTrip(id, its, trips));
  return listed.toSorted(
    (a, b) => Number(a.id === NO_TRIP) - Number(b.id === NO_TRIP) || b.start.localeCompare(a.start),
  );
}

/** One listed Trip, from its ID and its days with lines. */
function mapTrip(id: string, days: Set<string>, trips: TimelineLabel[]): MapTrip {
  const sorted = [...days].toSorted();
  const name =
    id === NO_TRIP ? "Days in no trip" : (trips.find((trip) => trip.id === id)?.name ?? id);
  return { id, name, start: sorted[0] ?? "", end: sorted.at(-1) ?? "", days: sorted.length };
}

/** The map without the trip lines of the hidden Trips, which the Trip tab turned off. */
export function withoutTrips(
  map: TripLinesMap,
  hidden: string[],
  trips: TimelineLabel[] = allTimelineLabels(),
): TripLinesMap {
  if (hidden.length === 0) return map;
  const off = new Set(hidden);
  return { ...map, features: map.features.filter((f) => !off.has(tripOf(f, trips))) };
}
