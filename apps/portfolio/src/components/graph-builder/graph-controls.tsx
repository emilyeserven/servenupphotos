import {
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { GraphField, StatOptions, StatSelect } from "@/components/graph-builder/graph-field";
import {
  type GraphConfig,
  type GraphType,
  type Measure,
  type SortOrder,
  SPLIT_TYPES,
} from "@/lib/graph-data";
import { CONTROL_FRAME, controlButtonClass, SELECT_CLASS } from "@/lib/segmented-control";

/** A change to some of the graph's settings. */
export type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The graph types, each with its button's label and icon. */
const TYPES: [GraphType, string, LucideIcon][] = [
  ["bar", "Bar", ChartColumn],
  ["line", "Line", ChartLine],
  ["dot", "Dot", CircleDot],
  ["pie", "Pie", ChartPie],
  ["scatter", "Scatter", ChartScatter],
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
 * The graph's settings in a row over it: its type, what's on each axis, what splits a bar or line
 * graph, and the x axis's order and how many of its values show.
 */
export function GraphControls({
  config,
  onChange,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <TypeButtons type={config.type} onChange={onChange} />
      <GraphField label={config.type === "pie" ? "Slices" : "X axis"}>
        <StatSelect value={config.x} onChange={(x) => onChange({ x })} />
      </GraphField>
      <YField config={config} onChange={onChange} />
      <SplitFields config={config} onChange={onChange} />
      <OrderFields config={config} onChange={onChange} />
    </div>
  );
}

/** The buttons picking the graph's type. */
function TypeButtons({ type, onChange }: { type: GraphType; onChange: ConfigChange }) {
  return (
    <div role="group" aria-label="Graph type" className={CONTROL_FRAME}>
      {TYPES.map(([option, label, Icon]) => (
        <button
          key={option}
          type="button"
          aria-pressed={type === option}
          onClick={() => onChange({ type: option })}
          title={label}
          className={controlButtonClass(type === option)}
        >
          <Icon aria-hidden />
          <span className="max-sm:sr-only">{label}</span>
        </button>
      ))}
    </div>
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
        <option value="count">Photos</option>
        <option value="percent">Share of photos (%)</option>
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
