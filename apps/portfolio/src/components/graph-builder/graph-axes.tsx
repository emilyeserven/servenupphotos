import type { ReactNode } from "react";
import { type ConfigChange, MeasureOptions } from "@/components/graph-builder/graph-controls";
import { StatOptions } from "@/components/graph-builder/graph-field";
import { type GraphConfig, hasYStat, type Measure } from "@/lib/graph-data";

/** How an axis's name on the graph looks: plain text with a dropdown arrow, shaded on hover. */
const AXIS_CLASS =
  "field-sizing-content cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** An axis's name on the graph, a dropdown that changes what's on it when clicked. */
function AxisPicker({
  name,
  value,
  onChange,
  children,
}: {
  /** What the axis is, such as "X axis", before its name and for screen readers. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {name}
      <select
        value={value}
        title={`Change the ${name.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value)}
        className={AXIS_CLASS}
      >
        {children}
      </select>
    </label>
  );
}

/** The y axis's name: the second stat on a scatterplot or heatmap, or what the other graphs measure. */
function YPicker({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
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
      <MeasureOptions />
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
 * top left, the x axis's centered under it. A pie names its slices and size over it.
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
        <div className="flex flex-wrap gap-x-4">
          <XPicker config={config} onChange={onChange} />
          <YPicker config={config} onChange={onChange} />
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <YPicker config={config} onChange={onChange} />
      {children}
      <div className="flex justify-center">
        <XPicker config={config} onChange={onChange} />
      </div>
    </div>
  );
}
