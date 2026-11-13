import type { ReactNode } from "react";
import { type GraphConfig, graphData, scatterData, seriesColor } from "@/lib/graph-data";
import { photoDots } from "@/lib/graph-photo-dots";
import {
  barShapes,
  heatmapShapes,
  lineShapes,
  photoDotShapes,
  pieShapes,
  scatterShapes,
  THUMB_HEIGHT,
  THUMB_WIDTH,
  type ThumbShape,
} from "@/lib/graph-thumbnail";
import type { Photo } from "@/lib/photos";

/** How each graph type's thumbnail is drawn, from the same data its real graph is drawn from. */
const SHAPES: Record<GraphConfig["type"], (list: Photo[], config: GraphConfig) => ThumbShape[]> = {
  bar: (list, config) => barShapes(graphData(list, config), config.stacked),
  line: (list, config) => lineShapes(graphData(list, config)),
  pie: (list, config) => pieShapes(graphData(list, config), seriesColor),
  heatmap: (list, config) =>
    heatmapShapes(scatterData(list, config), seriesColor(0), "var(--muted)"),
  scatter: (list, config) => scatterShapes(scatterData(list, config), seriesColor(0)),
  photos: (list, config) =>
    photoDotShapes(photoDots(list, config).columns.map((c) => c.dots.map((dot) => dot.color))),
};

/**
 * The thumbnails already drawn, for each list of photos the filters keep, by the graph's settings.
 * The list is a new array whenever the filters change, so its thumbnails are drawn again then, and
 * pointing at presets or switching groups reuses them.
 */
const drawn = new WeakMap<Photo[], Map<string, ThumbShape[]>>();

/** The thumbnail's shapes for the photos and settings, drawn once and then kept. */
function shapesFor(list: Photo[], config: GraphConfig): ThumbShape[] {
  const byConfig = drawn.get(list) ?? new Map<string, ThumbShape[]>();
  drawn.set(list, byConfig);
  const key = JSON.stringify(config);
  const known = byConfig.get(key);
  if (known) return known;
  const shapes = SHAPES[config.type](list, config);
  byConfig.set(key, shapes);
  return shapes;
}

/** A shape of one kind. */
type ShapeOf<K extends ThumbShape["kind"]> = Extract<ThumbShape, { kind: K }>;

/** How each kind of shape is drawn as SVG. */
const DRAW: { [K in ThumbShape["kind"]]: (shape: ShapeOf<K>) => ReactNode } = {
  rect: ({ x, y, width, height, fill, opacity }) => (
    <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={opacity} rx={0.6} />
  ),
  circle: ({ cx, cy, r, fill }) => <circle cx={cx} cy={cy} r={r} fill={fill} />,
  line: ({ points, stroke }) => (
    <polyline
      points={points}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  ),
  slice: ({ d, fill }) => <path d={d} fill={fill} stroke="var(--card)" strokeWidth={0.6} />,
};

/** One shape as SVG. */
function Shape({ shape }: { shape: ThumbShape }) {
  const draw = DRAW[shape.kind] as (shape: ThumbShape) => ReactNode;
  return draw(shape);
}

/**
 * A preset's small drawing in the Presets picker: its graph of the photos the filters keep, with
 * the preset's settings, but no axes, names, tooltip or key. Drawn as a light SVG rather than a
 * chart, and kept once drawn, so a dozen of them open quickly.
 */
export function PresetThumbnail({
  list,
  config,
}: {
  /** The photos the filters keep. */
  list: Photo[];
  /** The graph's settings with the preset's over them. */
  config: GraphConfig;
}) {
  const shapes = shapesFor(list, config);
  return (
    <svg
      viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
      aria-hidden
      className="aspect-[5/3] w-full rounded-md border bg-card"
    >
      {shapes.map((shape, index) => (
        <Shape key={index} shape={shape} />
      ))}
    </svg>
  );
}
