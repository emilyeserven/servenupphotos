import { useState } from "react";
import { GraphField } from "@portfolio/components/graph-builder/graph-field";
import { type GraphConfig, statById } from "@portfolio/lib/graph-data";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** One threshold's setting, such as `xMin`. */
type ThresholdKey = "xMin" | "xMax" | "yMin" | "yMax";

/**
 * A threshold as typed, as a number: "2.8", "-1", or a fraction such as "1/250" for an exposure;
 * null when it's empty, undefined while it isn't a number yet.
 */
function parseThreshold(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const [top = "", bottom = "1", ...rest] = trimmed.split("/");
  const value = Number(top) / Number(bottom);
  return rest.length === 0 && Number.isFinite(value) ? value : undefined;
}

/** A threshold as the box shows it: empty for no limit. */
function thresholdText(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Whether the axis can be cut to a range: its stat's values go in order. */
function ordered(stat: string): boolean {
  return statById(stat).ordered === true;
}

/** Whether the y axis has thresholds: a scatterplot's when its stat is ordered, the rest's always. */
function hasYRange(config: GraphConfig): boolean {
  return config.type !== "scatter" || ordered(config.y);
}

/** What the y range is of: a scatterplot's stat, a pie's size, or the photos on the y axis. */
function yName(config: GraphConfig): string {
  return config.type === "pie" ? "Size" : "Y axis";
}

/**
 * The lowest and highest value each axis shows, in the Adjust Graph box: the x axis's when its
 * stat's values go in order, such as Aperture or Year, and the y axis's, which for every graph but
 * a scatterplot is how many photos (or what share) an x value needs to show.
 */
export function GraphThresholds({
  config,
  onChange,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  const xName = config.type === "pie" ? "Slices" : "X axis";
  return (
    <div className="flex basis-full flex-wrap items-end gap-x-4 gap-y-3">
      {ordered(config.x) && (
        <ThresholdPair name={xName} keys={["xMin", "xMax"]} config={config} onChange={onChange} />
      )}
      {hasYRange(config) && (
        <ThresholdPair
          name={yName(config)}
          keys={["yMin", "yMax"]}
          config={config}
          onChange={onChange}
        />
      )}
    </div>
  );
}

interface PairProps {
  name: string;
  keys: [ThresholdKey, ThresholdKey];
  config: GraphConfig;
  onChange: ConfigChange;
}

/** An axis's lowest and highest value, side by side. */
function ThresholdPair({ name, keys: [min, max], config, onChange }: PairProps) {
  return (
    <>
      <GraphField label={`${name} from`}>
        <ThresholdInput value={config[min]} onChange={(value) => onChange({ [min]: value })} />
      </GraphField>
      <GraphField label={`${name} to`}>
        <ThresholdInput value={config[max]} onChange={(value) => onChange({ [max]: value })} />
      </GraphField>
    </>
  );
}

/**
 * A box for one threshold, kept as typed while it isn't a number yet, such as "1/" on the way to
 * "1/250", and set again when the threshold changes elsewhere, such as from a preset.
 */
function ThresholdInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(() => thresholdText(value));
  const typed = parseThreshold(text);
  if (typed !== undefined && typed !== value) setText(thresholdText(value));
  const type = (next: string) => {
    setText(next);
    const parsed = parseThreshold(next);
    if (parsed !== undefined) onChange(parsed);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="Any"
      value={text}
      onChange={(e) => type(e.target.value)}
      className={`${SELECT_CLASS} w-24 cursor-text`}
    />
  );
}
