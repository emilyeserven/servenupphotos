import { AxisSelect } from "@/components/graph-builder/axis-select";
import type { ConfigChange } from "@/components/graph-builder/graph-controls";
import { StatOptions } from "@/components/graph-builder/graph-field";
import type { GraphConfig } from "@/lib/graph-data";

/**
 * What splits the graph, named on the graph beside its **Key** like the axes' names: a dropdown of
 * None and the stats other than the x axis's. It writes the same setting as Adjust Graph's
 * **Split by**; only the bar, line and photo dot graphs show it, since only they can be split.
 */
export function SplitPicker({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <AxisSelect name="Split by" value={config.split} onChange={(split) => onChange({ split })}>
      <option value="">None</option>
      <StatOptions leaveOut={[config.x]} />
    </AxisSelect>
  );
}
