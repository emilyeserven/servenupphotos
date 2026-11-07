import type { ReactNode } from "react";
import { axisStatRows, type GraphConfig, hasYStat, yBuckets } from "@portfolio/lib/graph-data";
import { roundSteps } from "@portfolio/lib/graph-ranges";
import type { Photo } from "@portfolio/lib/photos";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import type { StatRow } from "@portfolio/lib/stat-groups";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The x axis's ends, or a pie's first and last slice, picked from its values in its order. */
export function XEnds({
  name,
  rows,
  config,
  onChange,
}: {
  name: string;
  rows: StatRow[];
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  return (
    <LabelEnds
      name={name}
      labels={rows.map((row) => row.label)}
      ends={[config.xFrom, config.xTo]}
      onChange={([xFrom, xTo]) => onChange({ xFrom, xTo })}
    />
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

/** The y axis's ends: a scatterplot's or heatmap's y values, a bar, line or dot graph's round numbers up to its top; none for a pie. */
export function YEnds({ config, rows, list, onChange }: YEndsProps) {
  if (config.type === "pie") return null;
  if (hasYStat(config.type)) {
    const labels = axisStatRows(list, yBuckets(config)).map((row) => row.label);
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
