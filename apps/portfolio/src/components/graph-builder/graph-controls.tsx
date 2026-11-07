import { GraphRanges } from "@portfolio/components/graph-builder/graph-ranges";
import {
  GraphField,
  StatOptions,
  StatSelect,
} from "@portfolio/components/graph-builder/graph-field";
import {
  type GraphConfig,
  type GraphType,
  type Measure,
  type SortOrder,
  SPLIT_TYPES,
} from "@portfolio/lib/graph-data";
import type { Photo } from "@portfolio/lib/photos";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** A change to some of the graph's settings. */
export type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The graph types, with their names. */
const TYPES: [GraphType, string][] = [
  ["bar", "Bar"],
  ["line", "Line"],
  ["dot", "Dot"],
  ["pie", "Pie"],
  ["scatter", "Scatter"],
];

/** The x axis's orders, with their names. */
const SORTS: [SortOrder, string][] = [
  ["group", "As on Numbers"],
  ["reverse", "Reversed"],
  ["count", "Most photos first"],
];

/** How many of the x axis's values can be shown; 0 is all. */
const LIMITS = [0, 5, 10, 20];

/**
 * The graph's settings, in the Adjust Graph box: its type, what's on each axis, what splits a bar,
 * line or dot graph, the x axis's order and how many of its values show, and the Range group.
 */
export function GraphControls({
  config,
  onChange,
  list,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the Range group's choices are read from; every photo when left out. */
  list?: Photo[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <TypeSelect type={config.type} onChange={onChange} />
      <GraphField label={config.type === "pie" ? "Slices" : "X axis"}>
        <StatSelect value={config.x} onChange={(x) => onChange({ x })} />
      </GraphField>
      <YField config={config} onChange={onChange} />
      <SplitFields config={config} onChange={onChange} />
      <OrderFields config={config} onChange={onChange} />
      <GraphRanges config={config} onChange={onChange} list={list} />
    </div>
  );
}

/** The dropdown picking the graph's type. */
function TypeSelect({ type, onChange }: { type: GraphType; onChange: ConfigChange }) {
  return (
    <GraphField label="Graph type">
      <select
        value={type}
        onChange={(e) => onChange({ type: e.target.value as GraphType })}
        className={SELECT_CLASS}
      >
        {TYPES.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
    </GraphField>
  );
}

/** What a bar, line, dot or pie graph can measure, as a dropdown's options. */
export function MeasureOptions() {
  return (
    <>
      <option value="count">Photos</option>
      <option value="percent">Share of photos (%)</option>
    </>
  );
}

/** The y axis: another stat for a scatterplot, or what's measured for the rest. */
function YField({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (config.type === "scatter") {
    return (
      <GraphField label="Y axis">
        <StatSelect value={config.y} onChange={(y) => onChange({ y })} leaveOut={[config.x]} />
      </GraphField>
    );
  }
  return (
    <GraphField label={config.type === "pie" ? "Size" : "Y axis"}>
      <select
        value={config.measure}
        onChange={(e) => onChange({ measure: e.target.value as Measure })}
        className={SELECT_CLASS}
      >
        <MeasureOptions />
      </select>
    </GraphField>
  );
}

/** What splits each bar or line, and for bars whether their parts stack; nothing for the other types. */
function SplitFields({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (!SPLIT_TYPES.has(config.type)) return null;
  return (
    <>
      <GraphField label="Split by">
        <select
          value={config.split}
          onChange={(e) => onChange({ split: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Nothing</option>
          <StatOptions leaveOut={[config.x]} />
        </select>
      </GraphField>
      <StackField config={config} onChange={onChange} />
    </>
  );
}

/** Whether a split bar's parts stack or stand side by side; nothing for an unsplit or other graph. */
function StackField({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (config.type !== "bar" || config.split === "") return null;
  return (
    <GraphField label="Parts">
      <select
        value={config.stacked ? "stacked" : "side"}
        onChange={(e) => onChange({ stacked: e.target.value === "stacked" })}
        className={SELECT_CLASS}
      >
        <option value="stacked">Stacked</option>
        <option value="side">Side by side</option>
      </select>
    </GraphField>
  );
}

/** The x axis's order and how many of its values show. */
function OrderFields({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <>
      <GraphField label="Order">
        <select
          value={config.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortOrder })}
          className={SELECT_CLASS}
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </GraphField>
      <GraphField label="Show">
        <select
          value={config.limit}
          onChange={(e) => onChange({ limit: Number(e.target.value) })}
          className={SELECT_CLASS}
        >
          {LIMITS.map((limit) => (
            <option key={limit} value={limit}>
              {limit === 0 ? "All" : `First ${limit}`}
            </option>
          ))}
        </select>
      </GraphField>
    </>
  );
}
