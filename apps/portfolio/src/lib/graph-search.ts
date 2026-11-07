import type { GraphConfig, GraphType, Measure, SortOrder } from "@portfolio/lib/graph-data";
import { builtInPresets } from "@portfolio/lib/graph-presets";
import { NO_RANGES } from "@portfolio/lib/graph-ranges";

/** The graph shown at first: photos per year, oldest first, each bar split by season. */
const GRAPH_START: GraphConfig = {
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

/**
 * The graph's settings as the Graph page keeps them in the URL, so a link shares the graph:
 * `graph`, a built-in preset by its ID, and each setting that differs from it (or from the first
 * graph), named with a `g` before it so it can't clash with the filters, such as `gType=pie`.
 */
export type GraphSearch = Partial<Record<GraphParam, string | number | boolean>>;

/** A graph param's name: `graph`, or a setting's with `g` before it. */
type GraphParam = "graph" | `g${Capitalize<keyof GraphConfig>}`;

/** A setting's name in the URL, such as gType for type. */
function paramOf(key: string): GraphParam {
  return `g${key[0]!.toUpperCase()}${key.slice(1)}` as GraphParam;
}

/** What a split of none is written as, since an empty value drops out of the URL. */
const NO_SPLIT = "none";

/** The settings that are numbers, or none (null) for a range end that's off. */
const NUMBER_KEYS = new Set([
  "limit",
  "minPhotos",
  "xBucket",
  "yBucket",
  "xWidth",
  "yWidth",
  "yMin",
  "yMax",
]);

/** The settings that are on or off. */
const BOOLEAN_KEYS = new Set(["stacked", "hideZeros"]);

/** The values the settings with set choices can take; a link with any other is ignored. */
const CHOICES: Partial<Record<keyof GraphConfig, readonly string[]>> = {
  type: ["bar", "line", "pie", "scatter", "heatmap", "photos"] satisfies GraphType[],
  measure: ["count", "percent"] satisfies Measure[],
  sort: ["group", "count", "reverse"] satisfies SortOrder[],
};

/** A setting as the URL writes it. */
function writeValue(key: string, value: unknown): string | number | boolean {
  if (key === "split" && value === "") return NO_SPLIT;
  return value as string | number | boolean;
}

/** A number from the URL, or undefined when it isn't one. */
function numberOf(value: unknown): number | undefined {
  const number = Number(value);
  return value !== "" && Number.isFinite(number) ? number : undefined;
}

/** A text setting from the URL, or undefined when it's not one of the setting's choices. */
function textOf(key: keyof GraphConfig, value: unknown): string | undefined {
  const text = String(value);
  if (key === "split" && text === NO_SPLIT) return "";
  return allowed(key, text) ? text : undefined;
}

/** Whether a text setting can be the text: any for a free one, one of its choices for the rest. */
function allowed(key: keyof GraphConfig, text: string): boolean {
  return CHOICES[key]?.includes(text) ?? true;
}

/** A setting from the URL as the graph keeps it, or undefined when it can't be read. */
function readValue(key: keyof GraphConfig, value: unknown): unknown {
  if (NUMBER_KEYS.has(key)) return numberOf(value);
  if (BOOLEAN_KEYS.has(key)) return String(value) === "true";
  return textOf(key, value);
}

/** The built-in preset the URL names, as the graph it starts from; the first graph when it names none. */
function baseOf(search: Record<string, unknown>): GraphConfig {
  const preset = builtInPresets().find((each) => each.id === search.graph);
  return preset ? { ...GRAPH_START, ...preset.graph } : GRAPH_START;
}

/** The graph a URL describes: its preset, or the first graph, with each setting it changes. */
export function graphFromSearch(search: Record<string, unknown>): GraphConfig {
  const base = baseOf(search);
  const changes = Object.keys(GRAPH_START).flatMap((key) => {
    const raw = search[paramOf(key)];
    const value = raw === undefined ? undefined : readValue(key as keyof GraphConfig, raw);
    return value === undefined ? [] : [[key, value]];
  });
  return { ...base, ...Object.fromEntries(changes) };
}

/** The graph's settings that differ from `base`, as URL params. */
function changedParams(config: GraphConfig, base: GraphConfig): GraphSearch {
  return Object.fromEntries(
    (Object.keys(GRAPH_START) as (keyof GraphConfig)[])
      .filter((key) => config[key] !== base[key])
      .map((key) => [paramOf(key), writeValue(key, config[key])]),
  );
}

/** Whether two graphs have every setting the same. */
function sameGraph(a: GraphConfig, b: GraphConfig): boolean {
  return Object.keys(changedParams(a, b)).length === 0;
}

/**
 * The graph as URL params: the built-in preset it is, by ID, when it's one; otherwise each setting
 * that differs from the first graph. A range end that's off is left out, so it reads as off.
 */
export function graphToSearch(config: GraphConfig): GraphSearch {
  const preset = builtInPresets().find((each) => sameGraph(config, baseOf({ graph: each.id })));
  if (preset) return { graph: preset.id };
  return changedParams(config, GRAPH_START);
}

/** Every graph param, which a new graph's URL drops before adding its own. */
export const GRAPH_PARAMS: GraphParam[] = ["graph", ...Object.keys(GRAPH_START).map(paramOf)];

/** The graph's params from a URL's search, for the route to keep. */
export function parseGraphSearch(search: Record<string, unknown>): GraphSearch {
  return Object.fromEntries(
    GRAPH_PARAMS.filter((key) => search[key] !== undefined).map((key) => [
      key,
      search[key] as string | number | boolean,
    ]),
  );
}
