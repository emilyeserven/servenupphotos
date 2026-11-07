import { queryOptions } from "@tanstack/react-query";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import { requestJson } from "@/api/settings";

/**
 * How a stretch of a day was travelled. A walk is drawn through every photo in it; the others are
 * a straight dashed line from the first point to the last. `transit` is a hop whose kind isn't
 * known, as the automatic line marks one.
 */
export type TripMode = "walk" | "train" | "subway" | "bus" | "car" | "transit";

/** A spot on a trip line with no photo, such as the hotel a day starts from. */
export interface TripPoint {
  latitude: number;
  longitude: number;
  /** Names the spot, such as "Hotel". */
  label?: string;
}

/** One stretch of a day's trip line, travelled one way. */
export interface TripSegment {
  mode: TripMode;
  /** A spot with no photo the line starts from, before the photos. */
  start?: TripPoint;
  /** The IDs of the day's photos the line goes through, in order. */
  photos: number[];
  /** A spot with no photo the line ends at, after the photos. */
  end?: TripPoint;
}

/**
 * A trip line file: the route of one day, which the portfolio's map draws. Commit combines them
 * into TRIPLINES.json, and bakes them with their photos' spots into TRIPLINES.geo.json.
 */
export interface TripLine {
  /** The day, such as "2026-09-23". */
  id: string;
  /** The same day as `id`. */
  day: string;
  /** True for the automatic line, worked out again from the day's photos at every Commit. */
  auto: boolean;
  /** The stretches of the day, in the order they happened; empty for the automatic line. */
  segments: TripSegment[];
}

function isTripLine(value: unknown): value is TripLine {
  const line = value as Partial<TripLine> | null;
  return typeof line?.day === "string" && Array.isArray(line.segments);
}

/** TRIPLINES.json with the changes since, at the pull request's head or else on the base branch. */
function lineEntries(data: CombinedData): unknown[] {
  return (data.head ?? data.base).triplines?.data ?? [];
}

/** The trip lines as the next Commit will have them, by day. */
export function tripLines(data: CombinedData): Map<string, TripLine> {
  return new Map(
    lineEntries(data)
      .filter(isTripLine)
      .map((line) => [line.day, line]),
  );
}

/** The automatic line of a day, as the next Commit would draw it from the photos then. */
export function autoTripLineQuery(day: string) {
  return queryOptions({
    queryKey: ["triplines", day, "auto"],
    queryFn: () => requestJson<TripLine>(`/api/triplines/${encodeURIComponent(day)}/auto`),
    retry: false,
  });
}

const tripLineMutations = settingMutations<TripLine>("triplines");

/** Saves a day's trip line, new or changed, as a change waiting for Commit. */
export const saveTripLineMutation = tripLineMutations.save;

/** Removes a day's trip line, as a change waiting for Commit. */
export const deleteTripLineMutation = tripLineMutations.remove;
