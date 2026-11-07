import { Link } from "@tanstack/react-router";
import { createContext, type ReactNode, use, useMemo } from "react";
import { tripColors, useIsDark } from "@/lib/map-theme";
import { fitView } from "@/lib/fit-view";
import {
  type RouteSketch,
  SKETCH_SIZE,
  type SketchLine,
  type SketchSize,
  routeSketch,
} from "@/lib/route-sketch";
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

/** A month's trip line map on the Timeline: the days with a line and their lines drawn together. */
export interface DaysSketch {
  days: string[];
  sketch: RouteSketch;
}

/**
 * Every line of the days, such as a month's days on the Timeline, drawn together in one box of
 * `size`; null when no day has a line.
 */
export function useDaysSketch(days: string[], size: SketchSize): DaysSketch | null {
  const { byDay: features, sketches } = use(SketchesContext);
  // Keyed by the days' text, so a new array of the same days keeps the sketch.
  const key = days.join(" ");
  return useMemo(() => {
    const lineDays = key.split(" ").filter((day) => sketches.has(day));
    const sketch = routeSketch(
      lineDays.flatMap((day) => features.get(day) ?? []),
      size,
    );
    return sketch && { days: lineDays, sketch };
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
      search={{ day, ...fitView(sketch.bounds, window.innerWidth, window.innerHeight) }}
      aria-label="Show this day's route on the map"
      title="Show this day's route on the map"
      className="-my-1 ml-auto shrink-0 rounded-sm bg-muted/60 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring max-[359px]:hidden"
    >
      <SketchDrawing sketch={sketch} />
    </Link>
  );
}

/** A route sketch's lines and places visited, drawn in a box of `size`. */
export function SketchDrawing({
  sketch,
  size = SKETCH_SIZE,
}: {
  sketch: RouteSketch;
  size?: SketchSize;
}) {
  const colors = tripColors(useIsDark());
  const { width, height } = size;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      {sketch.lines.map((line) => (
        <polyline
          key={`${line.mode}:${line.points}`}
          points={line.points}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...lineStyle(line, colors)}
        />
      ))}
      {sketch.visits.map(({ x, y }) => (
        <circle
          key={`${x},${y}`}
          cx={x}
          cy={y}
          r={2}
          fill={colors.visit}
          stroke={colors.visitEdge}
        />
      ))}
    </svg>
  );
}

type TripColors = ReturnType<typeof tripColors>;

/** How a line is drawn, as on the Map: walks solid, drives in long light blue dashes, rides in their line's color, other hops dashed. */
function lineStyle(line: SketchLine, colors: TripColors) {
  if (line.mode === "walk") return { stroke: colors.walk, strokeWidth: 2 };
  if (line.mode === "car") return { stroke: colors.drive, strokeWidth: 2, strokeDasharray: "5 2" };
  if (line.colour) return { stroke: line.colour, strokeWidth: 2 };
  return { stroke: colors.hop, strokeWidth: 1.5, strokeDasharray: "2 2" };
}
