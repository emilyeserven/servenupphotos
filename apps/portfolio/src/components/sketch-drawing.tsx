import { tripColors, useIsDark } from "@portfolio/lib/map-theme";
import {
  type RouteSketch,
  SKETCH_SIZE,
  type SketchLine,
  type SketchSize,
} from "@portfolio/lib/route-sketch";

/** The Map's trip line colors, for the theme in use. */
export type TripColors = ReturnType<typeof tripColors>;

/** How a sketch draws one of its lines: its stroke color, width and dashes as SVG attributes. */
export type SketchLineStyle = (
  line: SketchLine,
  colors: TripColors,
) => { stroke: string; strokeWidth: number; strokeDasharray?: string };

/** How a line is drawn, as on the Map: walks solid, drives solid light blue, rides in their line's color, other hops dashed. */
function mapLineStyle(line: SketchLine, colors: TripColors) {
  if (line.mode === "walk") return { stroke: colors.walk, strokeWidth: 2 };
  if (line.mode === "car") return { stroke: colors.drive, strokeWidth: 2 };
  if (line.colour) return { stroke: line.colour, strokeWidth: 2 };
  return { stroke: colors.hop, strokeWidth: 1.5, strokeDasharray: "2 2" };
}

interface SketchDrawingProps {
  sketch: RouteSketch;
  size?: SketchSize;
  /** How each line is drawn; the Map's line styles unless given. */
  lineStyle?: SketchLineStyle;
  /** Classes for the drawing, such as one that stretches it to its box; it's drawn at `size` without. */
  className?: string;
}

/** A route sketch's lines and places visited, drawn in a box of `size`. */
export function SketchDrawing({
  sketch,
  size = SKETCH_SIZE,
  lineStyle = mapLineStyle,
  className,
}: SketchDrawingProps) {
  const colors = tripColors(useIsDark());
  const { width, height } = size;
  const fixed = className ? {} : { width, height };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} {...fixed} className={className} aria-hidden>
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
