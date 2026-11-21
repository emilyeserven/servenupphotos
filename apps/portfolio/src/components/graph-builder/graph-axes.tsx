import type { ReactNode } from "react";
import { AxisSelect as AxisPicker } from "@/components/graph-builder/axis-select";
import type { ConfigChange } from "@/components/graph-builder/graph-controls";
import { StatOptions } from "@/components/graph-builder/graph-field";
import { KeyRow } from "@/components/graph-builder/graph-key";
import { PartsButtons } from "@/components/graph-builder/parts-buttons";
import { SplitPicker } from "@/components/graph-builder/split-picker";
import { type GraphConfig, hasYStat, type Measure, SPLIT_TYPES } from "@/lib/graph-data";
import { measureChange, measureChoices, shownMeasure } from "@/lib/graph-measure";

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
  return <MeasurePicker name={name} config={config} onChange={onChange} />;
}

/**
 * What the graph's values are, named on the graph: a bar, line or pie graph's y axis, or a
 * scatterplot's or heatmap's **Values** beside its key. With a second stat it offers a share within
 * each x value or each of that stat's values, so a busy value doesn't drown out the rest.
 */
function MeasurePicker({
  name,
  config,
  onChange,
}: {
  name: string;
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  return (
    <AxisPicker
      name={name}
      value={shownMeasure(config)}
      onChange={(measure) => onChange(measureChange(config, measure as Measure))}
    >
      {measureChoices(config).map(([measure, label]) => (
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
 * **Split by** dropdown on a bar, line or photo dot graph, and on a split bar its **Stacked** /
 * **Side by side** buttons (see `PartsButtons`), or a scatterplot's or heatmap's **Values**.
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
  return (
    <div className="flex flex-col gap-2">
      <KeyRow
        start={<YPicker config={config} onChange={onChange} />}
        end={rowEnd(config, onChange)}
      >
        {children}
      </KeyRow>
      <div className="flex justify-center">
        <XPicker config={config} onChange={onChange} />
      </div>
    </div>
  );
}

/**
 * What goes before the key over the graph: a bar, line or photo dot graph's **Split by** (and a
 * split bar's parts), or a scatterplot's or heatmap's **Values**.
 */
function rowEnd(config: GraphConfig, onChange: ConfigChange): ReactNode {
  if (hasYStat(config.type))
    return <MeasurePicker name="Values" config={config} onChange={onChange} />;
  if (!SPLIT_TYPES.has(config.type)) return undefined;
  return (
    <>
      <SplitPicker config={config} onChange={onChange} />
      <PartsButtons config={config} onChange={onChange} />
    </>
  );
}
