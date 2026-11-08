import type { CombinedData } from "@/api/photos";
import type { Place } from "@/api/places";
import { type TripLine, tripLines } from "@/api/trip-lines";
import { currentLists } from "@/lib/group-photos";
import { shownPhotos } from "@/lib/place-seeds";
import { plannedDay, type TripDay, tripDays } from "@/lib/trip-days";

/** A line marked by hand that no longer matches its day's photos. */
export interface StaleTripLine {
  day: string;
  /** How many of the day's photos with an exact spot the line doesn't go through, such as ones added since. */
  missing: number;
  /** How many photos the line goes through that are no longer on that day with an exact spot. */
  gone: number;
}

/** The places in the combined lists, for the photos at a place marked as an exact location. */
function placesOf(data: CombinedData): Place[] {
  return (currentLists(data).places.data ?? []) as Place[];
}

/** The days a trip line can be marked for, newest first, as the next Commit will have the photos. */
export function lineDays(data: CombinedData): TripDay[] {
  const days = tripDays(shownPhotos(data), placesOf(data));
  const known = new Set(days.map((d) => d.day));
  const planned = [...tripLines(data).values()]
    .filter((line) => line.planned && !known.has(line.day))
    .map((line) => plannedDay(line.day));
  return [...days, ...planned].toSorted((a, b) => b.day.localeCompare(a.day));
}

/** How many of ids aren't in other. */
function countMissing(ids: Set<number>, other: Set<number>): number {
  return [...ids].filter((id) => !other.has(id)).length;
}

/** The IDs of the day's photos with an exact spot; none for a day no longer listed. */
function photoIds(day: TripDay | undefined): Set<number> {
  return new Set((day?.photos ?? []).map((p) => p.id));
}

/** How a hand-marked line differs from its day's photos: the counts both ways. */
function staleness(line: TripLine, day: TripDay | undefined): StaleTripLine {
  const used = new Set(line.segments.flatMap((s) => s.photos));
  const onDay = photoIds(day);
  return { day: line.day, missing: countMissing(onDay, used), gone: countMissing(used, onDay) };
}

function isStale({ missing, gone }: StaleTripLine): boolean {
  return missing + gone > 0;
}

/**
 * The lines marked by hand that are out of date, newest day first: their day has photos with an
 * exact spot they don't go through (added since, or given a spot since), or they go through photos
 * no longer on that day with one. Automatic lines are worked out again at every Commit, so they never
 * are.
 */
export function staleTripLines(data: CombinedData): StaleTripLine[] {
  const days = new Map(lineDays(data).map((d) => [d.day, d]));
  return [...tripLines(data).values()]
    .filter((line) => !line.auto && !line.planned)
    .map((line) => staleness(line, days.get(line.day)))
    .filter(isStale)
    .toSorted((a, b) => b.day.localeCompare(a.day));
}
