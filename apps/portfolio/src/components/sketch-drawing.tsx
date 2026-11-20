import { tripColors, tripLineStroke, tripLineStyle, useIsDark } from "@portfolio/lib/map-theme";
import { type RouteSketch, SKETCH_SIZE, type SketchSize } from "@portfolio/lib/route-sketch";

interface SketchDrawingProps {
  sketch: RouteSketch;
  size?: SketchSize;
  /** Classes for the drawing, such as one that stretches it to its box; it's drawn at `size` without. */
  className?: string;
}

/** A route sketch's lines and places visited, drawn in a box of `size`. */
export function SketchDrawing({ sketch, size = SKETCH_SIZE, className }: SketchDrawingProps) {
  const dark = useIsDark();
  const colors = tripColors(dark);
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
          {...tripLineStroke(tripLineStyle(line.mode, line, dark, "sketch"))}
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
