import { allTimelineLabels, type TimelineLabel } from "@/lib/timeline-labels";
import type { TripLinesMap, TripMapFeature } from "@/lib/trip-lines-map";

/** The ID the map's Trip tab gives the trip lines of days in no Trip. */
export const NO_TRIP = "no-trip";

/** The prefix a hidden day's entry has among the hidden Trips, such as "day:2026-09-22". */
const DAY_PREFIX = "day:";

/** The entry that hides one day's trip lines, such as "day:2026-09-22". */
export function dayKey(day: string): string {
  return DAY_PREFIX + day;
}

/**
 * What the Trip tab says under its name about the hidden entries, such as "1 trip, 2 days hidden",
 * or "All trip lines shown".
 */
export function hiddenText(hidden: string[]): string {
  const days = hidden.filter((entry) => entry.startsWith(DAY_PREFIX)).length;
  const parts = [counted(hidden.length - days, "trip"), counted(days, "day")].filter(Boolean);
  return parts.length === 0 ? "All trip lines shown" : `${parts.join(", ")} hidden`;
}

/** A count with its noun, such as "2 days"; "" for none. */
function counted(count: number, noun: string): string {
  if (count === 0) return "";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** A Trip whose lines the map can draw, as the Places menu's Trip tab lists it. */
export interface MapTrip {
  /** The Trip's ID from TIMELINE.json, or `NO_TRIP` for the days in none. */
  id: string;
  /** The Trip's name, or "Days in no trip". */
  name: string;
  /** Its first and last days with trip lines on the map, such as "2026-09-22". */
  start: string;
  end: string;
  /** Its days with trip lines on the map, in order, such as "2026-09-22". */
  days: string[];
}

/** The day a feature is drawn on: for a leg between days, the day it arrived. */
function dayOf({ properties }: TripMapFeature): string {
  return properties.arrive ?? properties.day;
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
    days.set(id, (days.get(id) ?? new Set()).add(dayOf(feature)));
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
  return { id, name, start: sorted[0] ?? "", end: sorted.at(-1) ?? "", days: sorted };
}

/**
 * The map without the trip lines of the hidden Trips and days, which the Trip tab turned off.
 * `hidden` holds Trip IDs, and `dayKey`s for single days.
 */
export function withoutTrips(
  map: TripLinesMap,
  hidden: string[],
  trips: TimelineLabel[] = allTimelineLabels(),
): TripLinesMap {
  if (hidden.length === 0) return map;
  const off = new Set(hidden);
  return {
    ...map,
    features: map.features.filter((f) => !off.has(tripOf(f, trips)) && !off.has(dayKey(dayOf(f)))),
  };
}
