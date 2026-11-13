import type { ReactNode } from "react";
import { type GraphType, seriesColor } from "@portfolio/lib/graph-data";
import type { Fit, TypeFit } from "@portfolio/lib/graph-suggest";

/** What a graph type is for: the data it suits best. */
interface TypeNote {
  best: string;
}

/** Each graph type's note. */
const NOTES: Record<GraphType, TypeNote> = {
  bar: {
    best: "A handful to about 20 separate values, such as cameras, lenses or years.",
  },
  line: {
    best: "Values with an order, such as years, months, or a camera setting from low to high.",
  },
  pie: {
    best: "Shares of a whole across a few values, such as which cameras took the photos.",
  },
  scatter: {
    best: "How two stats go together, such as aperture against focal length.",
  },
  heatmap: {
    best: "Two stats with an order and many pairs, such as time of day by day of the week.",
  },
  photos: {
    best: "Smaller counts where each photo should show, such as the apertures used.",
  },
};

/** The diagrams' bar heights and dot heights, out of 60, so they look like real data. */
const HEIGHTS = [26, 44, 36, 58, 30];

/** A baseline under a diagram. */
function Baseline() {
  return <line x1="8" y1="84" x2="152" y2="84" className="stroke-border" strokeWidth="1.5" />;
}

/** Five bars of different heights. */
function BarDiagram() {
  return (
    <>
      <Baseline />
      {HEIGHTS.map((height, index) => (
        <rect
          key={index}
          x={18 + index * 27}
          y={84 - height}
          width="18"
          height={height}
          rx="2"
          fill={seriesColor(0)}
        />
      ))}
    </>
  );
}

/** A line through five points. */
function LineDiagram() {
  const points = HEIGHTS.map((height, index) => [27 + index * 27, 84 - height] as const);
  return (
    <>
      <Baseline />
      <polyline
        points={points.map((point) => point.join(",")).join(" ")}
        fill="none"
        stroke={seriesColor(0)}
        strokeWidth="2.5"
      />
      {points.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3.5" fill={seriesColor(0)} />
      ))}
    </>
  );
}

/** A ring of three slices, drawn as dashes of one circle's outline. */
function PieDiagram() {
  const length = 2 * Math.PI * 30;
  const shares = [0.5, 0.3, 0.2];
  return (
    <g transform="rotate(-90 80 48)">
      {shares.map((share, index) => {
        const before = shares.slice(0, index).reduce((sum, each) => sum + each, 0);
        return (
          <circle
            key={index}
            cx="80"
            cy="48"
            r="30"
            fill="none"
            stroke={seriesColor(index)}
            strokeWidth="16"
            strokeDasharray={`${share * length - 2} ${length}`}
            strokeDashoffset={-before * length}
          />
        );
      })}
    </g>
  );
}

/** Dots of different sizes over two axes. */
function ScatterDiagram() {
  const dots = [
    [30, 70, 4],
    [52, 58, 7],
    [70, 40, 5],
    [92, 50, 9],
    [112, 28, 4],
    [132, 20, 6],
    [60, 74, 3],
  ];
  return (
    <>
      <Baseline />
      <line x1="8" y1="8" x2="8" y2="84" className="stroke-border" strokeWidth="1.5" />
      {dots.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={seriesColor(0)} fillOpacity="0.75" />
      ))}
    </>
  );
}

/** A grid of cells, darker for more. */
function HeatmapDiagram() {
  const shades = [0.15, 0.5, 0.3, 0.9, 0.2, 0.6, 0.4, 0.1, 0.7, 0.3, 0.05, 0.8];
  return shades.map((shade, index) => (
    <rect
      key={index}
      x={26 + (index % 6) * 19}
      y={18 + Math.floor(index / 6) * 31}
      width="17"
      height="29"
      rx="2"
      fill={seriesColor(0)}
      fillOpacity={shade}
    />
  ));
}

/** Stacks of dots, one for each photo, colored by a split. */
function PhotosDiagram() {
  const stacks = [3, 6, 4, 8, 2];
  return (
    <>
      <Baseline />
      {stacks.flatMap((count, column) =>
        Array.from({ length: count }, (_, row) => (
          <circle
            key={`${column}-${row}`}
            cx={30 + column * 25}
            cy={78 - row * 9}
            r="3.5"
            fill={seriesColor((row + column) % 3)}
          />
        )),
      )}
    </>
  );
}

/** Each graph type's diagram. */
const DIAGRAMS: Record<GraphType, () => ReactNode> = {
  bar: BarDiagram,
  line: LineDiagram,
  pie: PieDiagram,
  scatter: ScatterDiagram,
  heatmap: HeatmapDiagram,
  photos: PhotosDiagram,
};

/** How the info pane names each fit. */
const FIT_NAMES: Record<Fit, string> = {
  best: "Suggested.",
  good: "A good fit.",
  poor: "A poor fit.",
};

/**
 * The Graph type picker's info pane: a little diagram of the type pointed at, or else the one
 * chosen, under a **Best for** heading the data it suits best, and under **For these axes** how it
 * suits what's on them, and why.
 */
export function GraphTypeInfo({
  type,
  name,
  fit,
}: {
  type: GraphType;
  name: string;
  fit: TypeFit;
}) {
  const Diagram = DIAGRAMS[type];
  const note = NOTES[type];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <svg
        viewBox="0 0 160 96"
        role="img"
        aria-label={`A ${name} graph`}
        className="w-full rounded-md bg-muted/40"
      >
        <Diagram />
      </svg>
      <p className="font-medium">{name}</p>
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">Best for</h4>
        <p className="text-muted-foreground">{note.best}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">
          For these axes
        </h4>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{FIT_NAMES[fit.fit]}</span> {fit.reason}
        </p>
      </div>
    </div>
  );
}
