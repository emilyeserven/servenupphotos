import {
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  Grip,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";
import type { GraphType } from "@portfolio/lib/graph-data";

/** The graph types, with their names and icons, as the Graph type picker and the graph's box list them. */
export const GRAPH_TYPES: [GraphType, string, LucideIcon][] = [
  ["bar", "Bar", ChartColumn],
  ["line", "Line", ChartLine],
  ["pie", "Pie", ChartPie],
  ["scatter", "Scatter", ChartScatter],
  ["heatmap", "Heatmap", Grid3x3],
  ["photos", "Photo dots", Grip],
];

/** The graph type's name and icon. */
export function graphTypeOf(type: GraphType): [GraphType, string, LucideIcon] {
  return GRAPH_TYPES.find(([each]) => each === type) ?? GRAPH_TYPES[0]!;
}
