import { mutationOptions, queryOptions } from "@tanstack/react-query";
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
  /** The name of the group of photos (a line of its own) the segment is in, such as "Nara Park". */
  name?: string;
  /** A spot with no photo the line starts from, before the photos. */
  start?: TripPoint;
  /** The IDs of the day's photos the line goes through, in order. */
  photos: number[];
  /** A spot with no photo the line ends at, after the photos. */
  end?: TripPoint;
  /** Spots the line goes through between its photos, to shape it. */
  via?: TripVia[];
  /**
   * The line along streets through its points, each [longitude, latitude], from Snap to streets, or
   * a hop's track along its `line`; none before either, which draws it straight through its points.
   */
  path?: [number, number][];
  /** The bus, subway or train line a hop rode, picked from the ones OpenStreetMap maps. */
  line?: TripTransitLine;
  /** The station or stop a hop with a line got on at, with its name as the label. */
  board?: TripPoint;
  /** The station or stop it got off at, which can be a walk away from the next photo. */
  alight?: TripPoint;
}

/** The bus, subway or train line a hop rode: an OpenStreetMap route, with its name and color. */
export interface TripTransitLine {
  /** The route's OpenStreetMap ID. */
  id: number;
  /** Its name, such as "Midosuji Line". */
  name: string;
  /** Its short number or letter, such as "M". */
  ref?: string;
  /** Its color, such as "#e5171f", which the map draws it in. */
  colour?: string;
}

/** A spot a segment's line goes through to shape it, such as a bridge crossed between two photos. */
export interface TripVia {
  /** The ID of the photo it comes after; left out, it comes right after the segment's start spot. */
  after?: number;
  latitude: number;
  longitude: number;
  /** The place visited (its index in the day's visits) this spot stands for; none for its own. */
  visit?: number;
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
  /** The places visited along the day's route, such as a restaurant, with or without a photo. */
  visits?: TripVisit[];
}

/** What sort of place a visit is. */
export type VisitKind = "restaurant" | "cafe" | "bar" | "shop" | "museum" | "sight" | "other";

/** A place visited along a day's route, shown as a pin on the map. */
export interface TripVisit {
  /** What it's called, such as "Ichiran Dotonbori". */
  name: string;
  kind: VisitKind;
  latitude: number;
  longitude: number;
  /** A few words about it. */
  note?: string;
  /** The place on an outside map, such as Google Maps or Naver Map. */
  link?: string;
  /** The ID of the saved place it is, when picked from them. */
  place?: string;
  /** The ID of the photo it comes after on the route; none leaves it off the route, as a pin only. */
  after?: number;
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

/** A trip line with its walks, bus rides and drives snapped to streets, not saved yet. */
interface RoutedTripLine {
  line: TripLine;
  /** How many of those got no route, so they stay straight. */
  unrouted: number;
}

/**
 * Snaps a day's trip line to streets with the OpenStreetMap routing servers, without saving it: each
 * walk, bus or car segment without a path gets one through its photos and via spots. The backend
 * asks at most once a second.
 */
export const routeTripLineMutation = mutationOptions({
  mutationKey: ["triplines", "route"],
  mutationFn: (line: TripLine) =>
    requestJson<RoutedTripLine>(`/api/triplines/${encodeURIComponent(line.day)}/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(line),
    }),
});

const tripLineMutations = settingMutations<TripLine>("triplines");

/** Saves a day's trip line, new or changed, as a change waiting for Commit. */
export const saveTripLineMutation = tripLineMutations.save;

/** Removes a day's trip line, as a change waiting for Commit. */
export const deleteTripLineMutation = tripLineMutations.remove;
