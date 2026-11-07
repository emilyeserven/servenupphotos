import { createContext, useContext } from "react";
import { OptionCheckbox, ViewOptionsButton } from "@/components/view-options-button";

/** How the graph is drawn, picked in its display options: only the pie has any yet. */
export interface GraphDisplay {
  /** Whether a pie names each slice with its value around it, when it's wide enough to fit them. */
  sliceLabels: boolean;
}

/** The display options as the graph first shows: everything on. */
export const DEFAULT_GRAPH_DISPLAY: GraphDisplay = { sliceLabels: true };

/** The display options, for the graphs that read them. */
export const GraphDisplayContext = createContext<GraphDisplay>(DEFAULT_GRAPH_DISPLAY);

/** The graph's display options, as its display options button has them. */
export function useGraphDisplay(): GraphDisplay {
  return useContext(GraphDisplayContext);
}

/** The eye button beside **Wide** that opens a pie's display options: whether its slices are named with their values. */
export function GraphDisplayOptions({
  display,
  onChange,
}: {
  display: GraphDisplay;
  onChange: (display: GraphDisplay) => void;
}) {
  return (
    <ViewOptionsButton onReset={() => onChange(DEFAULT_GRAPH_DISPLAY)}>
      <OptionCheckbox
        label="Slice names and values"
        checked={display.sliceLabels}
        onChange={(sliceLabels) => onChange({ ...display, sliceLabels })}
      />
    </ViewOptionsButton>
  );
}
