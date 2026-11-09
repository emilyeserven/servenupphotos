import { type SketchLineStyle, SketchDrawing } from "@portfolio/components/sketch-drawing";
import { routePlaces } from "@portfolio/lib/route-places";
import {
  type RouteSketch,
  type SketchFeature,
  type SketchSize,
  routeSketch,
} from "@portfolio/lib/route-sketch";
import type { TripLine } from "@/api/trip-lines";
import type { Trip } from "@/api/trips";
import { lineFeatures } from "@/components/trip-lines/route-geometry";
import type { TripDay } from "@/lib/trip-days";
import { orderedPhotos } from "@/lib/trip-order";

/** The size of a Trip's map when all its lines are in one place; it stretches to the card's width. */
const ONE_PLACE: SketchSize = { width: 240, height: 120, lane: 3 };

/** The size of each of a Trip's maps when its lines are in two or more places, such as two cities. */
const PLACES: SketchSize = { width: 144, height: 96, lane: 2.5 };

/** The days' lines and their photos, each by its day, as the Trips tab reads them once for every Trip. */
export interface DayLines {
  lines: Map<string, TripLine>;
  days: Map<string, TripDay>;
}

/** A day's line as sketch features: its segments, drawn the way the day's own preview draws them, and its trip stops. */
function dayFeatures(line: TripLine, day: TripDay | undefined): SketchFeature[] {
  const photos = orderedPhotos(day?.photos ?? [], line.order);
  const segments = lineFeatures(line.segments, photos).features.map((f) => ({
    geometry: f.geometry,
    properties: { mode: f.properties.mode, colour: f.properties.colour },
  }));
  const visits = (line.visits ?? []).map((v) => ({
    geometry: { type: "Point", coordinates: [v.longitude, v.latitude] },
    properties: { feature: "visit" },
  }));
  return [...segments, ...visits];
}

/** Each of the Trip's days with a line to draw, earliest first, with its sketch features. */
function tripFeatures(trip: Trip, { lines, days }: DayLines): Map<string, SketchFeature[]> {
  const byDay = new Map<string, SketchFeature[]>();
  const inTrip = [...lines.values()].filter((l) => l.day >= trip.start && l.day <= trip.end);
  for (const line of inTrip.toSorted((a, b) => a.day.localeCompare(b.day))) {
    const features = dayFeatures(line, days.get(line.day));
    if (features.some((f) => f.geometry.type === "LineString")) byDay.set(line.day, features);
  }
  return byDay;
}

/**
 * The Trip's lines as small maps, one for each place they're in (a city and its day trips together,
 * as the portfolio's Timeline groups a month's lines); none when no day has a line yet.
 */
function tripSketches(trip: Trip, dayLines: DayLines): RouteSketch[] {
  const byDay = tripFeatures(trip, dayLines);
  const places = routePlaces([...byDay.keys()], (day) => routeSketch(byDay.get(day)!)?.bounds);
  const size = places.length === 1 ? ONE_PLACE : PLACES;
  return places.flatMap(
    (place) =>
      routeSketch(
        place.days.flatMap((day) => byDay.get(day)!),
        size,
      ) ?? [],
  );
}

/** How a line is drawn: walks solid dark blue, drives solid light blue, transit dashed in its line's color. */
const lineStyle: SketchLineStyle = (line, colors) => {
  if (line.mode === "walk") return { stroke: colors.walk, strokeWidth: 2 };
  if (line.mode === "car") return { stroke: colors.drive, strokeWidth: 2 };
  return { stroke: line.colour ?? colors.hop, strokeWidth: 2, strokeDasharray: "4 3" };
};

/**
 * A Trip card's map preview of its days' lines: one map, or a small one for each place when its
 * lines are far apart; a note when none of its days has a line yet. Legs between days, such as a
 * flight, are left out so they don't shrink the days' routes to dots.
 */
export function TripPreview({ trip, dayLines }: { trip: Trip; dayLines: DayLines }) {
  const sketches = tripSketches(trip, dayLines);
  if (sketches.length === 0) {
    return (
      <span className="bg-muted/50 text-muted-foreground flex aspect-[2/1] items-center justify-center rounded-md px-3 text-center text-xs">
        No trip lines on these days yet
      </span>
    );
  }
  const size = sketches.length === 1 ? ONE_PLACE : PLACES;
  return (
    <ul
      aria-label={`The trip lines of ${trip.name}`}
      className={sketches.length === 1 ? "grid" : "grid grid-cols-2 gap-1.5"}
    >
      {sketches.map((sketch, i) => (
        <li key={i}>
          <SketchDrawing
            sketch={sketch}
            size={size}
            lineStyle={lineStyle}
            className="bg-muted/50 h-auto w-full rounded-md"
          />
        </li>
      ))}
    </ul>
  );
}
