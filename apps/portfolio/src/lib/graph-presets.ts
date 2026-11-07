import committedPresets from "@portfolio/data/graphs/GRAPHS.json";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import { type GraphRanges, NO_RANGES } from "@portfolio/lib/graph-ranges";
import { localFile } from "@portfolio/lib/localize";

/** What a graph preset sets the graph to: every setting but the filters, which stay as they are. */
export type PresetGraph = Omit<GraphConfig, "filters">;

/** A preset's graph as its file keeps it: the Range group's parts that are off are left out. */
export type SavedGraph = Omit<PresetGraph, keyof GraphRanges> & Partial<GraphRanges>;

/**
 * A graph preset file from GRAPHS.json, which the pipeline's Graph Presets page saves: a
 * ready-made graph, such as a dot graph of Aperture, or a preset group, which the Graph page shows
 * as one dropdown of its presets among the others.
 */
export interface GraphPresetFile {
  id: string;
  /** A ready-made graph, or a group of them. */
  kind: "preset" | "group";
  /** What its button or dropdown says. */
  name: string;
  /** Where it sits among the presets and groups, lowest first; a preset in a group, among the group's. */
  order: number;
  /** A preset's group, by ID; left out when it's in none. */
  group?: string;
  /** What a preset sets the graph to; groups leave it out. */
  graph?: SavedGraph;
}

/** A preset on the Graph page: its name, and what it sets the graph to, with the ranges it leaves out turned off. */
export interface GraphPreset {
  id: string;
  name: string;
  graph: Partial<PresetGraph>;
}

/** One button or dropdown in the Graph page's row of presets. */
export type PresetItem =
  | { kind: "preset"; preset: GraphPreset }
  | { kind: "group"; id: string; name: string; presets: GraphPreset[] };

// Like ALLPHOTOS.local.json, GRAPHS.local.json is git-ignored and only there locally.
/** Every graph preset and preset group, from GRAPHS.json. */
const presetFiles: GraphPresetFile[] =
  localFile(
    import.meta.glob<GraphPresetFile[]>("../data/graphs/GRAPHS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedPresets as GraphPresetFile[]);

/** Lowest order first, then by name. */
function byOrder(a: GraphPresetFile, b: GraphPresetFile): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

/** The file as a preset to pick. */
function presetOf(file: GraphPresetFile): GraphPreset {
  return { id: file.id, name: file.name, graph: { ...NO_RANGES, ...file.graph } };
}

/** The presets in the group, in their order. */
function groupPresets(files: GraphPresetFile[], group: string): GraphPreset[] {
  return files.filter((file) => file.kind === "preset" && file.group === group).map(presetOf);
}

/** Whether the preset sits in the row itself: it's in no group, or one that isn't there. */
function inRow(file: GraphPresetFile, groups: Set<string>): boolean {
  return file.kind === "group" || !groups.has(file.group ?? "");
}

/** The file as an item of the row, with a group's presets in it. */
function itemOf(file: GraphPresetFile, files: GraphPresetFile[]): PresetItem {
  if (file.kind === "preset") return { kind: "preset", preset: presetOf(file) };
  return { kind: "group", id: file.id, name: file.name, presets: groupPresets(files, file.id) };
}

/**
 * The Graph page's row of presets, in order: each preset in no group as a button, and each group
 * as a dropdown of its presets. A group with no presets is left out unless `keepEmpty`, as the
 * pipeline lists them.
 */
export function presetRow(files: GraphPresetFile[] = presetFiles, keepEmpty = false): PresetItem[] {
  const sorted = files.toSorted(byOrder);
  const groups = new Set(sorted.filter((file) => file.kind === "group").map((file) => file.id));
  return sorted
    .filter((file) => inRow(file, groups))
    .map((file) => itemOf(file, sorted))
    .filter((item) => keepEmpty || item.kind === "preset" || item.presets.length > 0);
}
