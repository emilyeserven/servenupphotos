import { graphTypeName } from "@portfolio/components/graph-builder/graph-type-picker";
import { statById } from "@portfolio/lib/graph-data";
import { orderName } from "@portfolio/lib/graph-order";
import type { PresetGraph } from "@portfolio/lib/graph-presets";
import type { GraphKey } from "@/components/graph-presets/preset-graph";

/** A setting's name, and what a value of it reads as on the graph it's in. */
type SettingText = [string, (graph: PresetGraph) => string];

/** A Range group part's value, or Off while it's off. */
function rangeText(value: string | number | null): string {
  return value === null || value === 0 ? "Off" : String(value);
}

/** A Range group part's line, read from the graph by its key. */
function rangePart(name: string, key: Exclude<GraphKey, "hideZeros">): SettingText {
  return [name, (graph) => rangeText(graph[key] as string | number | null)];
}

/** Each setting a preset keeps, with how its value reads. */
const SETTING_TEXT: Record<GraphKey, SettingText> = {
  type: ["Type", (g) => graphTypeName(g.type)],
  x: ["X axis or slices", (g) => statById(g.x).label],
  measure: ["Measure", (g) => (g.measure === "percent" ? "Share of photos (%)" : "Photos")],
  y: ["Y axis stat", (g) => statById(g.y).label],
  split: ["Split by", (g) => (g.split === "" ? "None" : statById(g.split).label)],
  stacked: ["Split bar parts", (g) => (g.stacked ? "Stacked" : "Side by side")],
  sort: ["Order", (g) => orderName(g.x, "X axis", g.sort)],
  limit: ["Show", (g) => (g.limit === 0 ? "All" : `First ${g.limit}`)],
  xFrom: rangePart("X range start", "xFrom"),
  xTo: rangePart("X range end", "xTo"),
  yFrom: rangePart("Y range start", "yFrom"),
  yTo: rangePart("Y range end", "yTo"),
  yMin: rangePart("Y axis start", "yMin"),
  yMax: rangePart("Y axis end", "yMax"),
  minPhotos: rangePart("Photos per value", "minPhotos"),
  hideZeros: ["Empty ends", (g) => (g.hideZeros ? "Trimmed" : "Kept")],
  xBucket: rangePart("X buckets", "xBucket"),
  yBucket: rangePart("Y buckets", "yBucket"),
  xWidth: rangePart("X even ranges", "xWidth"),
  yWidth: rangePart("Y even ranges", "yWidth"),
};

/**
 * The settings changed for every preset in a group, each as its name and new value, such as
 * Type: Pie, read from the graph shown with the changes made.
 */
export function changeLines(change: Partial<PresetGraph>, shown: PresetGraph): [string, string][] {
  return (Object.keys(change) as GraphKey[]).map((key) => {
    const [name, text] = SETTING_TEXT[key];
    return [name, text(shown)];
  });
}
