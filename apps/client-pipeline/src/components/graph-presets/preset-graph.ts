import type { PresetGraph, SavedGraph } from "@portfolio/lib/graph-presets";
import { NO_RANGES } from "@portfolio/lib/graph-ranges";

/** A new preset's graph, as the Graph page starts: photos per year, split by season. */
export const START_GRAPH: PresetGraph = {
  type: "bar",
  x: "year",
  measure: "count",
  y: "season",
  split: "season",
  stacked: true,
  sort: "reverse",
  limit: 0,
  ...NO_RANGES,
};

/** The settings a preset keeps, in the order its file writes them. */
const GRAPH_KEYS = [
  "type",
  "x",
  "measure",
  "y",
  "split",
  "stacked",
  "sort",
  "limit",
  ...(Object.keys(NO_RANGES) as (keyof typeof NO_RANGES)[]),
] as const;

/** One of the settings a preset keeps. */
export type GraphKey = (typeof GRAPH_KEYS)[number];

/** The graph's settings without its filters, which a preset leaves as they are. */
export function presetGraph(config: PresetGraph): PresetGraph {
  return Object.fromEntries(GRAPH_KEYS.map((key) => [key, config[key]])) as unknown as PresetGraph;
}

/** The settings in a change that a preset keeps, leaving out the filters. */
export function presetChange(change: Partial<PresetGraph>): Partial<PresetGraph> {
  return Object.fromEntries(
    GRAPH_KEYS.filter((key) => key in change).map((key) => [key, change[key]]),
  );
}

/** Whether a setting is a Range group part that's off, which the file leaves out. */
function isOff([key, value]: [string, unknown]): boolean {
  return key in NO_RANGES && NO_RANGES[key as keyof typeof NO_RANGES] === value;
}

/** The graph as the preset's file keeps it, with the Range group's parts that are off left out. */
export function savedGraph(graph: PresetGraph): SavedGraph {
  const kept = Object.entries(presetGraph(graph)).filter((entry) => !isOff(entry));
  return Object.fromEntries(kept) as SavedGraph;
}

/** A saved preset's whole graph, with what its file leaves out filled in. */
export function fullGraph(saved: SavedGraph | undefined): PresetGraph {
  return { ...START_GRAPH, ...saved };
}
