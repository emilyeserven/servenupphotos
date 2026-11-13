import type { GraphData, ScatterData } from "@/lib/graph-data";

// Only types come from graph-data, so this file loads in `node --test` without the stats and the
// photo data: the Presets picker works the graph's data out and hands it in.

/** How wide a preset's thumbnail is drawn, in its own units; the picker scales it to the tile. */
export const THUMB_WIDTH = 120;

/** How tall a preset's thumbnail is drawn, in the same units as its width. */
export const THUMB_HEIGHT = 72;

/** The space left empty around a thumbnail's drawing. */
const PAD = 4;

/** How wide the drawing is inside the empty space. */
const INNER_W = THUMB_WIDTH - PAD * 2;

/** How tall the drawing is inside the empty space. */
const INNER_H = THUMB_HEIGHT - PAD * 2;

/** Where the drawing's bars and stacks stand. */
const BOTTOM = THUMB_HEIGHT - PAD;

/** One shape of a thumbnail: a bar or heatmap cell, a dot, a line, or a pie slice. */
export type ThumbShape =
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      opacity?: number;
    }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string }
  | { kind: "line"; points: string; stroke: string }
  | { kind: "slice"; d: string; fill: string };

/** The color of the nth slice or series, as the real graph colors it. */
export type ColorOf = (index: number) => string;

/** A number rounded to two places, so the SVG stays short. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Each x value's numbers, in the series' order. */
function valuesOf(graph: GraphData): number[][] {
  return graph.data.map((datum) => graph.series.map((s) => datum.values[s.key] ?? 0));
}

/** The tallest bar's height: the biggest sum of a stack, or the biggest single value. */
function tallest(rows: number[][], stacked: boolean): number {
  const heights = rows.map((row) =>
    stacked ? row.reduce((a, b) => a + b, 0) : Math.max(0, ...row),
  );
  return Math.max(0, ...heights);
}

/** A bar's part as a rect, from where its bottom is; none when it's empty. */
function barRect(
  x: number,
  bottom: number,
  width: number,
  height: number,
  fill: string,
): ThumbShape[] {
  if (height <= 0) return [];
  const h = round(height);
  return [
    { kind: "rect", x: round(x), y: round(bottom - height), width: round(width), height: h, fill },
  ];
}

/** One x value's bar: its series stacked from the bottom up, or side by side. */
function barAt(
  row: number[],
  x: number,
  width: number,
  scale: number,
  graph: GraphData,
  stacked: boolean,
) {
  if (stacked || row.length === 1) {
    let bottom = BOTTOM;
    return row.flatMap((value, index) => {
      const shape = barRect(x, bottom, width, value * scale, graph.series[index]!.color);
      bottom -= value * scale;
      return shape;
    });
  }
  const each = width / row.length;
  return row.flatMap((value, index) =>
    barRect(x + index * each, BOTTOM, each, value * scale, graph.series[index]!.color),
  );
}

/**
 * A bar graph's thumbnail: a bar for each x value, as tall as its share of the tallest, its split
 * parts stacked or side by side in their series' colors.
 */
export function barShapes(graph: GraphData, stacked: boolean): ThumbShape[] {
  const rows = valuesOf(graph);
  const top = tallest(rows, stacked);
  if (rows.length === 0 || top <= 0) return [];
  const slot = INNER_W / rows.length;
  const width = slot * 0.75;
  return rows.flatMap((row, i) =>
    barAt(row, PAD + i * slot + (slot - width) / 2, width, INNER_H / top, graph, stacked),
  );
}

/** Where the ith of n points sits across: spread over the width, or in the middle when it's alone. */
function across(i: number, n: number): number {
  return PAD + (n === 1 ? INNER_W / 2 : (i / (n - 1)) * INNER_W);
}

/** A line graph's thumbnail: one line for each series through its x values, as high as each one's share of the highest. */
export function lineShapes(graph: GraphData): ThumbShape[] {
  const rows = valuesOf(graph);
  const top = tallest(rows, false);
  if (rows.length === 0 || top <= 0) return [];
  return graph.series.map((s, j) => ({
    kind: "line",
    stroke: s.color,
    points: rows
      .map(
        (row, i) => `${round(across(i, rows.length))},${round(BOTTOM - (row[j]! / top) * INNER_H)}`,
      )
      .join(" "),
  }));
}

/** The point on the pie's edge at the angle, in radians from the top, clockwise. */
function edge(angle: number, r: number): string {
  const cx = THUMB_WIDTH / 2;
  const cy = THUMB_HEIGHT / 2;
  return `${round(cx + r * Math.sin(angle))},${round(cy - r * Math.cos(angle))}`;
}

/** One slice's path, from the middle out to its arc and back. */
function slicePath(start: number, end: number, r: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const middle = `${THUMB_WIDTH / 2},${THUMB_HEIGHT / 2}`;
  return `M${middle} L${edge(start, r)} A${r},${r} 0 ${large} 1 ${edge(end, r)} Z`;
}

/** A pie's thumbnail: a slice for each of its slices, from the top clockwise, in the real pie's colors. */
export function pieShapes(graph: GraphData, colorOf: ColorOf): ThumbShape[] {
  const key = graph.series[0]?.key ?? "value";
  const values = graph.data.map((datum) => Math.max(0, datum.values[key] ?? 0));
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const r = INNER_H / 2;
  // A slice that's the whole pie can't be drawn as one arc, so it's a circle.
  if (values.filter((v) => v > 0).length === 1) {
    const index = values.findIndex((v) => v > 0);
    return [{ kind: "circle", cx: THUMB_WIDTH / 2, cy: THUMB_HEIGHT / 2, r, fill: colorOf(index) }];
  }
  let start = 0;
  return values.flatMap((value, index) => {
    if (value === 0) return [];
    const end = start + (value / total) * Math.PI * 2;
    const shape: ThumbShape = { kind: "slice", d: slicePath(start, end, r), fill: colorOf(index) };
    start = end;
    return [shape];
  });
}

/** How many photos the busiest pair has, at least 1. */
function mostOf(data: ScatterData): number {
  return Math.max(1, ...data.points.map((point) => point.count));
}

/**
 * A heatmap's thumbnail: a cell for every pair of x and y values, the x values across and the y
 * values down, each as strong in `fill` as its share of the busiest pair; empty ones in `empty`.
 */
export function heatmapShapes(data: ScatterData, fill: string, empty: string): ThumbShape[] {
  const nx = data.xLabels.length;
  const ny = data.yLabels.length;
  if (nx === 0 || ny === 0) return [];
  const counts = new Map(data.points.map((p) => [`${p.x}:${p.y}`, p.count]));
  const most = mostOf(data);
  const w = INNER_W / nx;
  const h = INNER_H / ny;
  const gap = Math.min(w, h) > 4 ? 0.6 : 0;
  return data.yLabels.flatMap((_, y) =>
    data.xLabels.map((_, x): ThumbShape => {
      const count = counts.get(`${x}:${y}`) ?? 0;
      const rect = { kind: "rect" as const, x: round(PAD + x * w), y: round(PAD + y * h) };
      const size = { width: round(w - gap), height: round(h - gap) };
      if (count === 0) return { ...rect, ...size, fill: empty };
      return { ...rect, ...size, fill, opacity: round(0.2 + 0.8 * (count / most)) };
    }),
  );
}

/**
 * A scatterplot's thumbnail: a dot where each pair of values with photos meets, the first y value
 * at the bottom, its area as big as its share of the busiest pair.
 */
export function scatterShapes(data: ScatterData, fill: string): ThumbShape[] {
  const nx = data.xLabels.length;
  const ny = data.yLabels.length;
  if (nx === 0 || ny === 0) return [];
  const most = mostOf(data);
  const w = INNER_W / nx;
  const h = INNER_H / ny;
  const biggest = Math.min(w, h, 10) / 2;
  return data.points.map((p) => ({
    kind: "circle",
    cx: round(PAD + (p.x + 0.5) * w),
    cy: round(BOTTOM - (p.y + 0.5) * h),
    r: round(Math.max(0.8, biggest * Math.sqrt(p.count / most))),
    fill,
  }));
}

/** How many dots high a photo dot thumbnail's tallest stack is, at most. */
const MAX_DOT_ROWS = 14;

/**
 * A photo dot graph's thumbnail: a stack of dots over each x value, from each stack's dot colors
 * in order, the tallest reaching the top. Past 14 dots high, each dot stands for the same number of
 * photos, colored as the first of them, so the stacks keep their heights side by side.
 */
export function photoDotShapes(columns: string[][]): ThumbShape[] {
  const most = Math.max(0, ...columns.map((colors) => colors.length));
  if (most === 0) return [];
  const per = Math.ceil(most / MAX_DOT_ROWS);
  const slot = INNER_W / columns.length;
  const rise = INNER_H / Math.ceil(most / per);
  const r = round(Math.min(slot, rise, 8) * 0.38);
  return columns.flatMap((colors, i) =>
    Array.from({ length: Math.ceil(colors.length / per) }, (_, k) => ({
      kind: "circle" as const,
      cx: round(PAD + (i + 0.5) * slot),
      cy: round(BOTTOM - (k + 0.5) * rise),
      r,
      fill: colors[k * per]!,
    })),
  );
}
