import { createContext, useContext } from "react";
import type { GraphDatum } from "@/lib/graph-data";
import type { GraphPick } from "@/lib/graph-pick";

/** The value picked on the graph, and picking another by clicking a bar, point, slice or dot. */
interface PickState {
  pick: GraphPick | null;
  onPick: (pick: GraphPick) => void;
}

/** The Graph page's picked value, handed to the graphs so a click picks and the picked value stands out. */
export const GraphPickContext = createContext<PickState>({ pick: null, onPick: () => {} });

/** The value picked on the graph, and picking another. */
export function useGraphPick(): PickState {
  return useContext(GraphPickContext);
}

/** A bar, line point or slice as a pick: its x value, and an Other slice's values. */
export function pickOf(datum: GraphDatum | undefined): GraphPick | null {
  if (!datum) return null;
  return datum.others ? { x: datum.label, others: datum.others } : { x: datum.label };
}

/** How faint a value that isn't picked is, while another is. */
export function pickedOpacity(pick: GraphPick | null, x: string): number {
  return pick === null || pick.x === x ? 1 : 0.35;
}
