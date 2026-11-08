import { overrideId } from "@/api/cameras";
import { mutationOptions } from "@tanstack/react-query";
import { settingMutations } from "@/api/data-files";
import { post } from "@/api/data";
import type { PendingSave } from "@/api/scan-changes";
import type { CombinedData } from "@/api/photos";
import type { TripPoint, TripTransitLine } from "@/api/trip-lines";
import type { CombinedPhoto } from "@/lib/group-photos";

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
  /**
   * The ID of the day's photo it leaves from or arrives at, such as one taken at the airport, so a
   * day can have several legs from different spots. Left out, it's the day's last or first photo.
   */
  photo?: number;
}

/** One stretch of a Trip from one day to another, such as a ferry or a flight. */
export interface TripLeg {
  mode: LegMode;
  from: TripLegEnd;
  to: TripLegEnd;
  /** The train, bus or ferry line ridden, picked from the ones OpenStreetMap maps; none when not picked. */
  line?: TripTransitLine;
  /** The line's track between the leg's ends, each [longitude, latitude], drawn instead of a straight line. */
  path?: [number, number][];
}

/**
 * A Trip file: a name for a run of days, such as "Japan", which the portfolio's Timeline shows
 * beside those days, and the legs travelled between them, such as the ferry from Busan to Fukuoka.
 * Kept in the timeline folder as `<id>.json` (once the timeline labels) and combined into
 * TIMELINE.json; Commit bakes its legs into TRIPLINES.geo.json and its days' stories into its Trip
 * page.
 */
export interface Trip {
  /** Made from the name and first day, such as "japan-2026-09-22", also its file name. */
  id: string;
  /** What it's called, as the Timeline shows it, such as "Japan". */
  name: string;
  /** Its first and last days, both included, such as "2026-09-22". */
  start: string;
  end: string;
  /** The legs between days, in the order they were travelled; none for a run of days alone. */
  legs: TripLeg[];
  /**
   * Names for parts of the Trip on the Timeline, such as "Korea" and "Japan" in a "Korea and Japan"
   * Trip, each on the days picked for it; a day none covers shows the Trip's name.
   */
  labels: TripLabel[];
}

/** A timeline label within a Trip: a name the Timeline shows beside its days in place of the Trip's. */
export interface TripLabel {
  name: string;
  /** Its first and last days, both included, within the Trip. */
  start: string;
  end: string;
}

/** A Trip as its file may have it: the timeline labels had no legs, and most Trips no labels. */
type TripFile = Omit<Trip, "legs" | "labels"> & { legs?: TripLeg[]; labels?: TripLabel[] };

function isTripFile(value: unknown): value is TripFile {
  const trip = value as Partial<TripFile> | null;
  return (
    typeof trip?.id === "string" && typeof trip.name === "string" && typeof trip.start === "string"
  );
}

/** The Trip files among entries, each with its legs. */
function tripsOf(entries: unknown[] | undefined): Trip[] {
  return (entries ?? []).filter(isTripFile).map(withLists);
}

/** The Trip file with its legs and labels, empty when it has none. */
function withLists(trip: TripFile): Trip {
  return { ...trip, legs: trip.legs ?? [], labels: trip.labels ?? [] };
}

/**
 * The Trips saved in the trip lines folder as `trip-<slug>.json` before Trips and timeline labels
 * became one thing. Saving one again moves it to the timeline folder.
 */
function legacyTrips(entries: unknown[] | undefined): Trip[] {
  return tripsOf(entries).filter((trip) => trip.id.startsWith("trip-"));
}

/** The Trips in the timeline folder, and those saved in the trip lines folder before that aren't. */
function savedTrips(data: CombinedData): { saved: Trip[]; old: Trip[] } {
  const files = data.head ?? data.base;
  const saved = tripsOf(files.timeline.data);
  const ids = new Set(saved.map((t) => t.id));
  return { saved, old: legacyTrips(files.triplines?.data).filter((t) => !ids.has(t.id)) };
}

/** The Trips as the next Commit will have them, newest first. */
export function trips(data: CombinedData | undefined): Trip[] {
  if (!data) return [];
  const { saved, old } = savedTrips(data);
  return [...saved, ...old].toSorted((a, b) => b.start.localeCompare(a.start));
}

/**
 * The IDs of the Trips still in the trip lines folder from before, which the Timeline doesn't show
 * until they're saved again.
 */
export function legacyTripIds(data: CombinedData): Set<string> {
  return new Set(savedTrips(data).old.map((t) => t.id));
}

/** The ID a new Trip gets, such as `japan-2026-09-22`. */
export function tripId(name: string, start: string): string {
  return overrideId(`${name} ${start}`);
}

/** Another Trip that covers any day from start to end, which saving would clash with. */
export function overlappingTrip(
  all: Trip[],
  trip: Pick<Trip, "id" | "start" | "end">,
): Trip | undefined {
  return all.find((o) => o.id !== trip.id && o.start <= trip.end && trip.start <= o.end);
}

/**
 * The day the photo was taken, as its custom date or else its EXIF date writes it, such as
 * "2026-09-22" for "2026:09:22 18:42:05"; undefined when it has neither.
 */
function photoDay(photo: CombinedPhoto): string | undefined {
  const date = textOf(photo.customCreateDate) || textOf(photo.createDate);
  return /^(\d{4}):(\d{2}):(\d{2})/.exec(date)?.slice(1).join("-");
}

/** A field's text, trimmed, or "" when it isn't text. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** How many of the photos were taken on a day from start to end, both included. */
export function photosBetween(photos: CombinedPhoto[], start: string, end: string): number {
  return photos.filter((photo) => {
    const day = photoDay(photo);
    return day !== undefined && day >= start && day <= end;
  }).length;
}

/**
 * One Trip from several: its first day the earliest, its last the latest, its legs all of theirs,
 * and its labels each one's labels, or else its name on its days, so the Timeline still shows
 * "Korea" and "Japan" inside "Korea and Japan". It keeps the earliest one's ID.
 */
export function combinedTrip(name: string, parts: Trip[]): Trip {
  const ordered = parts.toSorted((a, b) => a.start.localeCompare(b.start));
  return {
    id: ordered[0]!.id,
    name,
    start: ordered[0]!.start,
    end: ordered
      .map((t) => t.end)
      .toSorted()
      .at(-1)!,
    legs: ordered.flatMap((t) => t.legs),
    labels: ordered.flatMap(labelsOf),
  };
}

/** The Trip's labels, or else one for its name on all its days. */
function labelsOf(trip: Trip): TripLabel[] {
  if (trip.labels.length > 0) return trip.labels;
  return [{ name: trip.name, start: trip.start, end: trip.end }];
}

/** The files combining Trips changed: the new Trip saved, the others removed. */
function combineChanges(result: PendingSave) {
  return result.changes.map((change) => ({
    kind: change.path.includes("/triplines/") ? ("triplines" as const) : ("timeline" as const),
    ...change,
  }));
}

/** Saves one Trip in place of several, as one change waiting for Commit. */
export const combineTripsMutation = mutationOptions({
  mutationKey: ["trips", "combine"],
  scope: { id: "photo-data-entries" },
  meta: { saves: true, changes: (result) => combineChanges(result as PendingSave) },
  mutationFn: ({ trip, ids }: { trip: Trip; ids: string[] }) =>
    post<PendingSave & { path: string }>("/api/trips/combine", { trip, ids }),
});

const tripMutations = settingMutations<Trip>("timeline", "trips");

/** Saves a Trip, new or changed, as a change waiting for Commit. */
export const saveTripMutation = tripMutations.save;

/** Removes a Trip, as a change waiting for Commit. */
export const deleteTripMutation = tripMutations.remove;
