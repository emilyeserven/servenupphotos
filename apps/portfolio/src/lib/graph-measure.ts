import {
  type GraphConfig,
  hasYStat,
  type Measure,
  SPLIT_TYPES,
  statById,
} from "@portfolio/lib/graph-data";

/** The settings a graph's measure and its names are read from. */
type MeasureGraph = Pick<GraphConfig, "type" | "x" | "y" | "split" | "measure">;

/**
 * The graph's second stat, which a `series` share is out of: a split bar or line graph's split, or
 * a scatterplot's or heatmap's y stat; "" when it has none, such as a pie or an unsplit bar.
 */
function secondStat(graph: MeasureGraph): string {
  if (hasYStat(graph.type)) return graph.y;
  return SPLIT_TYPES.has(graph.type) && graph.type !== "photos" ? graph.split : "";
}

/**
 * What the graph's values can be, with their names. Without a second stat: **Photos** or **Share
 * of photos (%)**. With one, a share within each x value or within each of the second stat's values,
 * such as **Share within Month (%)** and **Share within Year (%)**.
 */
export function measureChoices(graph: MeasureGraph): [Measure, string][] {
  const second = secondStat(graph);
  if (second === "") {
    return [
      ["count", "Photos"],
      ["percent", "Share of photos (%)"],
    ];
  }
  return [
    ["count", "Photos"],
    ["percent", shareWithin(graph.x)],
    ["series", shareWithin(second)],
  ];
}

/** A share's name within each of a stat's values, such as "Share within Year (%)". */
function shareWithin(stat: string): string {
  return `Share within ${statById(stat).label} (%)`;
}

/**
 * The measure the graph draws: its own, except a `series` share on a graph with no second stat,
 * such as after its split is set to None, which is a share of every photo.
 */
export function shownMeasure(graph: MeasureGraph): Measure {
  return graph.measure === "series" && secondStat(graph) === "" ? "percent" : graph.measure;
}

/** The name of what the graph's values are, such as "Photos" or "Share within Year (%)". */
export function measureName(graph: MeasureGraph): string {
  const shown = shownMeasure(graph);
  return measureChoices(graph).find(([measure]) => measure === shown)?.[1] ?? "Photos";
}

/**
 * The change that sets the measure. A split bar's parts go side by side for a `series` share, since
 * shares of different split values don't add up to anything when stacked.
 */
export function measureChange(graph: MeasureGraph, measure: Measure): Partial<GraphConfig> {
  return measure === "series" && graph.type === "bar" ? { measure, stacked: false } : { measure };
}
