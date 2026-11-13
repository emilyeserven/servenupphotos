import type { ReactNode } from "react";
import { MEASURES } from "@/components/graph-builder/axes-picker";
import { AxisSelect as AxisPicker } from "@/components/graph-builder/axis-select";
import { KeyRow } from "@/components/graph-builder/graph-key";
import type { ConfigChange } from "@/components/graph-builder/graph-controls";
import { StatOptions } from "@/components/graph-builder/graph-field";
import { SplitPicker } from "@/components/graph-builder/split-picker";
import { type GraphConfig, hasYStat, type Measure, SPLIT_TYPES } from "@/lib/graph-data";

/**
 * The y axis's name: the second stat on a scatterplot or heatmap, none on a photo dot graph, or what
 * the other graphs measure.
 */
function YPicker({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (config.type === "photos") return null;
  const name = config.type === "pie" ? "Size" : "Y axis";
  if (hasYStat(config.type)) {
    return (
      <AxisPicker name={name} value={config.y} onChange={(y) => onChange({ y })}>
        <StatOptions leaveOut={[config.x]} />
      </AxisPicker>
    );
  }
  return (
    <AxisPicker
      name={name}
      value={config.measure}
      onChange={(measure) => onChange({ measure: measure as Measure })}
    >
      {MEASURES.map(([measure, label]) => (
        <option key={measure} value={measure}>
          {label}
        </option>
      ))}
    </AxisPicker>
  );
}

/** The x axis's name, or a pie's slices. */
function XPicker({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <AxisPicker
      name={config.type === "pie" ? "Slices" : "X axis"}
      value={config.x}
      onChange={(x) => onChange({ x })}
    >
      <StatOptions />
    </AxisPicker>
  );
}

/**
 * The graph with each axis named, each name a dropdown to change it: the y axis's over the graph's
 * top left, the x axis's centered under it. A pie names its slices and size over it. The graph's
 * key, when it has one, sits at the right end of the row over it (see `KeyRow`), after the
 * **Split by** dropdown on a bar, line or photo dot graph.
 */
export function AxisLabels({
  config,
  onChange,
  children,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
  children: ReactNode;
}) {
  if (config.type === "pie") {
    return (
      <div className="flex flex-col gap-2">
        <KeyRow
          start={
            <div className="flex flex-wrap gap-x-4">
              <XPicker config={config} onChange={onChange} />
              <YPicker config={config} onChange={onChange} />
            </div>
          }
        >
          {children}
        </KeyRow>
      </div>
    );
  }
  const split = SPLIT_TYPES.has(config.type) ? (
    <SplitPicker config={config} onChange={onChange} />
  ) : undefined;
  return (
    <div className="flex flex-col gap-2">
      <KeyRow start={<YPicker config={config} onChange={onChange} />} end={split}>
        {children}
      </KeyRow>
      <div className="flex justify-center">
        <XPicker config={config} onChange={onChange} />
      </div>
    </div>
  );
}
