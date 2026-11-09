import { Link } from "@tanstack/react-router";
import { createContext, type ReactNode, use, useMemo } from "react";
import { fitView } from "@/lib/fit-view";
import { SketchDrawing } from "@/components/sketch-drawing";
import { type RouteSketch, type SketchSize, routeSketch } from "@/lib/route-sketch";
import { type RoutePlace, routePlaces } from "@/lib/route-places";
import { type TripMapFeature, useTripLinesMap } from "@/lib/trip-lines-map";

/** TRIPLINES.geo.json's features by their day, and each day's route sketch, both by `yyyy-MM-dd`. */
interface Sketches {
  byDay: Map<string, TripMapFeature[]>;
  sketches: Map<string, RouteSketch>;
}

const SketchesContext = createContext<Sketches>({ byDay: new Map(), sketches: new Map() });

/** The features of TRIPLINES.geo.json by their day. */
function byDay(features: TripMapFeature[]): Map<string, TripMapFeature[]> {
  const days = new Map<string, TripMapFeature[]>();
  for (const feature of features) {
    const day = feature.properties.day;
    days.set(day, [...(days.get(day) ?? []), feature]);
  }
  return days;
}

/** The features by their day, and every day's sketch for the days with a line to draw. */
function sketchesOf(features: TripMapFeature[]): Sketches {
  const days = byDay(features);
  const sketches = new Map<string, RouteSketch>();
  for (const [day, dayFeatures] of days) {
    const sketch = routeSketch(dayFeatures);
    if (sketch) sketches.set(day, sketch);
  }
  return { byDay: days, sketches };
}

/**
 * Loads TRIPLINES.geo.json for the Timeline, which draws a small sketch of each day's route in the
 * day's heading and a map of a month's lines under the month's. Until it loads, there are none.
 */
export function RouteSketches({ children }: { children: ReactNode }) {
  const map = useTripLinesMap(true);
  const sketches = useMemo(() => sketchesOf(map?.features ?? []), [map]);
  return <SketchesContext value={sketches}>{children}</SketchesContext>;
}

/** One of a month's small maps on the Timeline: the days on it and their lines drawn together. */
export interface DaysSketch {
  days: string[];
  sketch: RouteSketch;
}

/** The lines of the place's days drawn together in a box of `size`. */
function placeSketch(
  { days }: RoutePlace,
  features: Map<string, TripMapFeature[]>,
  size: SketchSize,
): DaysSketch | null {
  const sketch = routeSketch(
    days.flatMap((day) => features.get(day) ?? []),
    size,
  );
  return sketch && { days, sketch };
}

/**
 * The lines of the days, such as a month's days on the Timeline, drawn together in boxes of `size`,
 * one for each place they're in (see `routePlaces`); none when no day has a line.
 */
export function useDaysSketches(days: string[], size: SketchSize): DaysSketch[] {
  const { byDay: features, sketches } = use(SketchesContext);
  // Keyed by the days' text, so a new array of the same days keeps the sketches.
  const key = days.join(" ");
  return useMemo(() => {
    const places = routePlaces(key.split(" "), (day) => sketches.get(day)?.bounds);
    return places.flatMap((place) => placeSketch(place, features, size) ?? []);
  }, [key, features, sketches, size]);
}

/**
 * A day's route as a small sketch, in the same line styles as the Map, linking to the Map on that
 * day, zoomed to fit its whole line; nothing for a day without a trip line.
 */
export function TimelineRouteSketch({ day }: { day: string }) {
  const sketch = use(SketchesContext).sketches.get(day);
  if (!sketch) return null;
  return (
    <Link
      to="/map"
      search={{
        start: day,
        end: day,
        ...fitView(sketch.bounds, window.innerWidth, window.innerHeight),
      }}
      aria-label="Show this day's route on the map"
      title="Show this day's route on the map"
      className="-my-1 ml-auto shrink-0 rounded-sm bg-muted/60 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring max-[359px]:hidden"
    >
      <SketchDrawing sketch={sketch} />
    </Link>
  );
}
