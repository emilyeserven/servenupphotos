import { filterWithCamera } from "@portfolio/lib/camera-filters";
import type { Photo } from "@portfolio/lib/photos";
import type { GroupDef, StatGroup, StatRow } from "@portfolio/lib/stat-groups";
import {
  type GraphRanges,
  rangedRows,
  rowsBetween,
  type YDomain,
  yDomain,
} from "@portfolio/lib/graph-ranges";
import { SETTING_STATS } from "@portfolio/lib/graph-settings";
import { STAT_SECTIONS } from "@portfolio/lib/stats";

/** A stat a graph can be drawn by: one of the Numbers page's groups, such as Cameras or
 * Season, or a camera setting, such as Aperture. */
export interface GraphStat {
  id: string;
  label: string;
  /** The section it's in, such as "Gear" or "Technical", to group the dropdowns by. */
  section: string;
  build: (list: Photo[]) => StatGroup;
}

/** A group's stats: the group itself, or each of its variants, such as Lenses by type and by brand. */
function statsOf(def: GroupDef, section: string): GraphStat[] {
  if (!def.variants) return [{ id: def.id, label: def.build([]).title, section, build: def.build }];
  return def.variants.map((variant, index) => ({
    id: `${def.id}-${index}`,
    label: variant.label,
    section,
    build: variant.build,
  }));
}

/** Every stat a graph can be drawn by: the Numbers page's, in its order, then the camera settings. */
export const GRAPH_STATS: GraphStat[] = [
  ...STAT_SECTIONS.flatMap((section) =>
    section.groups.flatMap((def) => statsOf(def, section.title)),
  ),
  ...SETTING_STATS,
];

/** The stat with the ID, or the first one when there's none, such as after the groups change. */
export function statById(id: string): GraphStat {
  return GRAPH_STATS.find((stat) => stat.id === id) ?? GRAPH_STATS[0]!;
}

/** The kinds of graph the builder draws. */
export type GraphType = "bar" | "line" | "dot" | "pie" | "scatter";

/** What a bar, line or pie measures: how many photos, or their share in percent. */
export type Measure = "count" | "percent";

/** What order the x axis's values go in: the Numbers card's own, most photos first, or the card's reversed. */
export type SortOrder = "group" | "count" | "reverse";

/** Everything a person picks for their graph, with how much of each axis it shows. */
export interface GraphConfig extends GraphRanges {
  type: GraphType;
  /** The stat along the x axis, or the pie's slices. */
  x: string;
  /** What a bar, line or pie measures. */
  measure: Measure;
  /** The stat along a scatterplot's y axis. */
  y: string;
  /** The stat that splits each bar or line, or "" for none. */
  split: string;
  /** Whether a split bar's parts are stacked, or side by side. */
  stacked: boolean;
  sort: SortOrder;
  /** How many of the x axis's values are shown, from the start of the order; 0 for all. */
  limit: number;
}

/** A row's photos among the list: none for a row without a filter, which can't be told apart. */
export function rowPhotos(list: Photo[], row: StatRow): Photo[] {
  return row.filter ? filterWithCamera(list, row.filter) : [];
}

/** How the x axis's rows are put in order before the limit. */
const SORTS: Record<SortOrder, (rows: StatRow[]) => StatRow[]> = {
  group: (rows) => rows,
  count: (rows) => rows.toSorted((a, b) => b.count - a.count),
  reverse: (rows) => rows.toReversed(),
};

/** Every x value the photos have, in the order picked: what the Range group picks the x axis's ends from. */
export function axisValues(list: Photo[], config: GraphConfig): StatRow[] {
  return SORTS[config.sort](statById(config.x).build(list).rows);
}

/** The x axis's rows, in the order picked, cut by the Range group and then to the limit. */
function axisRows(list: Photo[], config: GraphConfig): StatRow[] {
  const kept = rangedRows(axisValues(list, config), config);
  return config.limit > 0 ? kept.slice(0, config.limit) : kept;
}

/** How many series or slices get their own color; the rest go together as Other. */
const MAX_SERIES = 8;

/** A line, a part of a bar, or a slice, with its color. */
export interface GraphSeries {
  key: string;
  label: string;
  color: string;
}

/** One value along the x axis, with a number for each series, by the series' key. */
export interface GraphDatum {
  label: string;
  /** How many photos the value has, for the tooltip. */
  photos: number;
  values: Record<string, number>;
  /** A pie's Other slice: the x values it puts together. */
  others?: string[];
}

/** What a bar, line or pie graph draws. */
export interface GraphData {
  series: GraphSeries[];
  data: GraphDatum[];
  /** Where a bar, line or dot graph's y axis runs, when the Range group sets it. */
  domain?: YDomain;
}

/** The color of the nth series, from the Graph page's palette; Other's is gray. */
export function seriesColor(index: number): string {
  return index < MAX_SERIES ? `var(--series-${index + 1})` : "var(--muted-foreground)";
}

/** The key Other's numbers are kept under. */
const OTHER = "other";

/** The number for a count of photos out of a total: the count, or its share in percent. */
function measured(count: number, total: number, measure: Measure): number {
  if (measure === "count") return count;
  return total > 0 ? (count / total) * 100 : 0;
}

/** An unsplit graph: one series, each x value's photos out of every photo kept. */
function singleSeries(rows: StatRow[], total: number, config: GraphConfig): GraphData {
  const label = config.measure === "count" ? "Photos" : "Share of photos";
  return {
    series: [{ key: "value", label, color: seriesColor(0) }],
    data: rows.map((row) => ({
      label: row.label,
      photos: row.count,
      values: { value: measured(row.count, total, config.measure) },
    })),
  };
}

/** The split's series: its values among the photos kept, the ones past the colors going together as Other. */
function splitSeries(rows: StatRow[]): GraphSeries[] {
  const own = rows.length > MAX_SERIES ? rows.slice(0, MAX_SERIES - 1) : rows;
  const series = own.map((row, index) => ({
    key: `s${index}`,
    label: row.label,
    color: seriesColor(index),
  }));
  if (own.length < rows.length)
    series.push({ key: OTHER, label: "Other", color: seriesColor(MAX_SERIES) });
  return series;
}

/** Each series' count among one x value's photos, Other's being the rest of the split's values. */
function splitCounts(split: StatGroup, series: GraphSeries[]): Record<string, number> {
  const keys = new Map(series.map((s) => [s.label, s.key]));
  const counts: Record<string, number> = Object.fromEntries(series.map((s) => [s.key, 0]));
  for (const row of split.rows) {
    const key = keys.get(row.label) ?? OTHER;
    counts[key] = (counts[key] ?? 0) + row.count;
  }
  return counts;
}

/** The counts as the measure: as they are, or each as a share of the x value's photos. */
function measuredAll(counts: Record<string, number>, total: number, measure: Measure) {
  return Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, measured(count, total, measure)]),
  );
}

/** A split graph: each x value's photos counted again by the split, one series per split value. */
function splitData(list: Photo[], rows: StatRow[], config: GraphConfig): GraphData {
  const stat = statById(config.split);
  const series = splitSeries(stat.build(list).rows);
  const data = rows.map((row) => {
    const counts = splitCounts(stat.build(rowPhotos(list, row)), series);
    return {
      label: row.label,
      photos: row.count,
      values: measuredAll(counts, row.count, config.measure),
    };
  });
  return { series, data };
}

/** A pie's slices: the x values, the ones past the colors going together as Other. */
function pieData(rows: StatRow[], total: number, config: GraphConfig): GraphData {
  const own = rows.length > MAX_SERIES ? rows.slice(0, MAX_SERIES - 1) : rows;
  const rest = rows.slice(own.length).reduce((sum, row) => sum + row.count, 0);
  const slices = rest > 0 ? [...own, { label: "Other", count: rest }] : own;
  const single = singleSeries(slices, total, config);
  const others = rows.slice(own.length).map((row) => row.label);
  const data = single.data.map((datum, index) =>
    index < own.length ? datum : { ...datum, others },
  );
  return { series: single.series, data };
}

/** The graph types whose values can be split by another stat. */
export const SPLIT_TYPES: ReadonlySet<GraphType> = new Set(["bar", "line", "dot"]);

/** Whether the graph is split: a bar, line or dot graph with a stat to split by. */
function isSplit(config: GraphConfig): boolean {
  return config.split !== "" && SPLIT_TYPES.has(config.type);
}

/** What a bar, line or pie graph draws from the photos kept. */
export function graphData(list: Photo[], config: GraphConfig): GraphData {
  const rows = axisRows(list, config);
  if (config.type === "pie") return pieData(rows, list.length, config);
  const graph = isSplit(config)
    ? splitData(list, rows, config)
    : singleSeries(rows, list.length, config);
  return { ...graph, domain: yDomain(config) };
}

/** One dot of a scatterplot: where it sits on each axis, by the values' places, and how many photos it has. */
export interface ScatterPoint {
  x: number;
  y: number;
  count: number;
}

/** What a scatterplot draws: each axis's values, and a dot for every pair with photos. */
export interface ScatterData {
  xLabels: string[];
  yLabels: string[];
  points: ScatterPoint[];
}

/** A scatterplot: a dot for each x value and y value the same photos have, as big as how many. */
export function scatterData(list: Photo[], config: GraphConfig): ScatterData {
  const xRows = axisRows(list, config);
  const yStat = statById(config.y);
  const yLabels = rowsBetween(yStat.build(list).rows, config.yFrom, config.yTo).map(
    (row) => row.label,
  );
  const points = xRows.flatMap((row, x) =>
    yStat
      .build(rowPhotos(list, row))
      .rows.map((cell) => ({ x, y: yLabels.indexOf(cell.label), count: cell.count })),
  );
  return {
    xLabels: xRows.map((row) => row.label),
    yLabels,
    points: points.filter((p) => p.y >= 0),
  };
}

/** A number on the graph as text: a count as it is, a share with a % sign. */
export function formatValue(value: number, measure: Measure): string {
  if (measure === "count") return value.toLocaleString();
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}
