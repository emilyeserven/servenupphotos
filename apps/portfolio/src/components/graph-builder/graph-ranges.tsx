import type { ReactNode } from "react";
import { GraphField } from "@portfolio/components/graph-builder/graph-field";
import { OptionCheckbox } from "@portfolio/components/view-options-button";
import { axisValues, type GraphConfig, statById } from "@portfolio/lib/graph-data";
import { photoCounts, roundSteps } from "@portfolio/lib/graph-ranges";
import { type Photo, photos as allPhotos } from "@portfolio/lib/photos";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import type { StatRow } from "@portfolio/lib/stat-groups";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

interface RangesProps {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the choices are read from: the ones the filters keep, or else every photo. */
  list?: Photo[];
}

/**
 * The Range group in the Adjust Graph box: the first and last value on each axis, each picked from
 * the values the axis has, how many photos an x value needs to show (picked from the counts they
 * have), and a switch that trims the values with no photos off the axis's ends.
 */
export function GraphRanges({ config, onChange, list = allPhotos }: RangesProps) {
  const rows = axisValues(list, config);
  return (
    <fieldset className="flex basis-full flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">Range</legend>
      <LabelEnds
        name={config.type === "pie" ? "Slices" : "X axis"}
        labels={rows.map((row) => row.label)}
        ends={[config.xFrom, config.xTo]}
        onChange={([xFrom, xTo]) => onChange({ xFrom, xTo })}
      />
      <YEnds config={config} rows={rows} list={list} onChange={onChange} />
      <PhotoThreshold config={config} rows={rows} onChange={onChange} />
      <HideZeros checked={config.hideZeros} onChange={(hideZeros) => onChange({ hideZeros })} />
    </fieldset>
  );
}

/** A pair of ends: null for the axis's own. */
type Ends<T> = [T | null, T | null];

interface LabelEndsProps {
  name: string;
  labels: string[];
  ends: Ends<string>;
  onChange: (ends: Ends<string>) => void;
}

/** From and To dropdowns of an axis's values, in its order. */
function LabelEnds({ name, labels, ends: [from, to], onChange }: LabelEndsProps) {
  const options = labels.map((label) => ({ value: label, label }));
  return (
    <EndPair name={name}>
      <EndSelect
        label={`${name} from`}
        value={from ?? ""}
        none="Start"
        options={options}
        onChange={(v) => onChange([v || null, to])}
      />
      <EndSelect
        label={`${name} to`}
        value={to ?? ""}
        none="End"
        options={options}
        onChange={(v) => onChange([from, v || null])}
      />
    </EndPair>
  );
}

/** A number as a dropdown's value: "" for none. */
function numberValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/** A dropdown's value as a number: null for none. */
function numberOf(value: string): number | null {
  return value === "" ? null : Number(value);
}

/** The highest a bar, line or dot graph's y axis needs to reach: 100 for shares, else the most photos an x value has. */
function yTop(config: GraphConfig, rows: StatRow[]): number {
  if (config.measure === "percent") return 100;
  return Math.max(1, ...rows.map((row) => row.count));
}

interface YEndsProps {
  config: GraphConfig;
  rows: StatRow[];
  list: Photo[];
  onChange: ConfigChange;
}

/** The y axis's ends: a scatterplot's y values, a bar, line or dot graph's round numbers up to its top; none for a pie. */
function YEnds({ config, rows, list, onChange }: YEndsProps) {
  if (config.type === "pie") return null;
  if (config.type === "scatter") {
    const labels = statById(config.y)
      .build(list)
      .rows.map((row) => row.label);
    return (
      <LabelEnds
        name="Y axis"
        labels={labels}
        ends={[config.yFrom, config.yTo]}
        onChange={([yFrom, yTo]) => onChange({ yFrom, yTo })}
      />
    );
  }
  return <NumberEnds config={config} rows={rows} onChange={onChange} />;
}

/** From and To dropdowns of round numbers for a bar, line or dot graph's y axis. */
function NumberEnds({ config, rows, onChange }: Omit<YEndsProps, "list">) {
  const suffix = config.measure === "percent" ? "%" : "";
  const options = roundSteps(yTop(config, rows)).map((n) => ({
    value: String(n),
    label: `${n.toLocaleString()}${suffix}`,
  }));
  return (
    <EndPair name="Y axis">
      <EndSelect
        label="Y axis from"
        value={numberValue(config.yMin)}
        none="0"
        options={options}
        onChange={(v) => onChange({ yMin: numberOf(v) })}
      />
      <EndSelect
        label="Y axis to"
        value={numberValue(config.yMax)}
        none="Top"
        options={options}
        onChange={(v) => onChange({ yMax: numberOf(v) })}
      />
    </EndPair>
  );
}

interface ThresholdProps {
  config: GraphConfig;
  rows: StatRow[];
  onChange: ConfigChange;
}

/** How many photos an x value needs to show, from the counts the x values have. */
function PhotoThreshold({ config, rows, onChange }: ThresholdProps) {
  const counts = photoCounts(rows).filter((count) => count > 1);
  return (
    <GraphField label="Photos per value">
      <select
        value={String(config.minPhotos)}
        onChange={(e) => onChange({ minPhotos: Number(e.target.value) })}
        className={SELECT_CLASS}
      >
        <option value="0">Any</option>
        {counts.map((count) => (
          <option key={count} value={count}>
            At least {count}
          </option>
        ))}
        {config.minPhotos > 0 && !counts.includes(config.minPhotos) && (
          <option value={config.minPhotos}>At least {config.minPhotos}</option>
        )}
      </select>
    </GraphField>
  );
}

/** The checkbox that leaves out the x values with no photos at either end of the axis. */
function HideZeros({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex h-8 items-center text-sm">
      <OptionCheckbox label="Trim empty ends" checked={checked} onChange={onChange} />
    </div>
  );
}

/** An axis's name over its From and To dropdowns, joined by a dash. */
function EndPair({ name, children }: { name: string; children: [ReactNode, ReactNode] }) {
  return (
    <div role="group" aria-label={name} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{name}</span>
      <span className="flex items-center gap-1.5">
        {children[0]}
        <span aria-hidden>–</span>
        {children[1]}
      </span>
    </div>
  );
}

interface EndSelectProps {
  /** Its name for screen readers, such as "X axis from". */
  label: string;
  value: string;
  /** What the dropdown says for the axis's own end, such as "Start". */
  none: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** One end's dropdown: the axis's own end, then the values to pick from; a picked one no longer there is kept. */
function EndSelect({ label, value, none, options, onChange }: EndSelectProps) {
  const missing = value !== "" && !options.some((option) => option.value === value);
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${SELECT_CLASS} max-w-40`}
    >
      <option value="">{none}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {missing && <option value={value}>{value}</option>}
    </select>
  );
}
