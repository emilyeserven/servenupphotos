import { overrideId } from "@/api/cameras";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import type { TripPoint } from "@/api/trip-lines";

/** How a Trip's leg between days was travelled. */
export type LegMode = "ferry" | "flight" | "train" | "bus" | "car";

/** One end of a leg: a day of the Trip, and the spot on it. */
export interface TripLegEnd {
  /** The day it left or arrived, such as "2026-09-21". Days can be skipped. */
  day: string;
  /**
   * A spot with no photo, such as an airport or "Home". Left out, the leg uses the day's photos:
   * the last one taken where it leaves, the first where it arrives.
   */
  spot?: TripPoint;
}

/** One stretch of a Trip from one day to another, such as a ferry or a flight. */
export interface TripLeg {
  mode: LegMode;
  from: TripLegEnd;
  to: TripLegEnd;
}

/**
 * A Trip file: a run of days and the legs travelled between them, such as the ferry from Busan to
 * Fukuoka. Kept in the trip lines folder as `trip-<slug>.json`, and Commit bakes its legs into
 * TRIPLINES.geo.json with the days' lines.
 */
export interface Trip {
  /** "trip-" and a slug, such as "trip-korea-japan-2026", also its file name. */
  id: string;
  /** What it's called, such as "Korea and Japan". */
  name: string;
  /** Its first and last days, such as "2026-09-20". */
  start: string;
  end: string;
  /** The legs between days, in the order they were travelled. */
  legs: TripLeg[];
}

function isTrip(value: unknown): value is Trip {
  const trip = value as Partial<Trip> | null;
  return typeof trip?.id === "string" && trip.id.startsWith("trip-") && Array.isArray(trip.legs);
}

/** The Trips as the next Commit will have them, newest first. */
export function trips(data: CombinedData): Trip[] {
  const entries = (data.head ?? data.base).triplines?.data ?? [];
  return entries.filter(isTrip).toSorted((a, b) => b.start.localeCompare(a.start));
}

/** The ID a new Trip gets, such as `trip-korea-japan-2026-09-20`. */
export function tripId(name: string, start: string): string {
  return overrideId(`trip ${name} ${start}`);
}

/** Another Trip that covers any day from start to end, which saving would clash with. */
export function overlappingTrip(all: Trip[], trip: Trip): Trip | undefined {
  return all.find((o) => o.id !== trip.id && o.start <= trip.end && trip.start <= o.end);
}

const tripMutations = settingMutations<Trip>("triplines", "trips");

/** Saves a Trip, new or changed, as a change waiting for Commit. */
export const saveTripMutation = tripMutations.save;

/** Removes a Trip, as a change waiting for Commit. */
export const deleteTripMutation = tripMutations.remove;
