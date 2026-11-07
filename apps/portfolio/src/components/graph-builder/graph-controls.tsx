import { ArrowDownUp, Eye, MoveRight, MoveUp } from "lucide-react";
import { GraphRanges } from "@portfolio/components/graph-builder/graph-ranges";
import { GraphTypePicker } from "@portfolio/components/graph-builder/graph-type-picker";
import { GraphField, StatSelect } from "@portfolio/components/graph-builder/graph-field";
import {
  type GraphConfig,
  hasYStat,
  type Measure,
  type SortOrder,
} from "@portfolio/lib/graph-data";
import type { Photo } from "@portfolio/lib/photos";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** A change to some of the graph's settings. */
export type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The x axis's orders, with their names. */
const SORTS: [SortOrder, string][] = [
  ["group", "As on Numbers"],
  ["reverse", "Reversed"],
  ["count", "Most photos first"],
];

/** The order's name, such as Reversed, for the Presets picker's settings. */
export function sortName(sort: SortOrder): string {
  return SORTS.find(([value]) => value === sort)?.[1] ?? "";
}

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
      <GraphTypePicker config={config} onChange={onChange} />
      <GraphField label={config.type === "pie" ? "Slices" : "X axis"} icon={MoveRight}>
        <StatSelect value={config.x} onChange={(x) => onChange({ x })} />
      </GraphField>
      <YField config={config} onChange={onChange} />
      <OrderFields config={config} onChange={onChange} />
      <GraphRanges config={config} onChange={onChange} list={list} />
    </div>
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

/** The y axis: another stat for a scatterplot or heatmap, or what's measured for the rest. */
function YField({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (hasYStat(config.type)) {
    return (
      <GraphField label="Y axis" icon={MoveUp}>
        <StatSelect value={config.y} onChange={(y) => onChange({ y })} leaveOut={[config.x]} />
      </GraphField>
    );
  }
  return (
    <GraphField label={config.type === "pie" ? "Size" : "Y axis"} icon={MoveUp}>
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

/** The x axis's order and how many of its values show. */
function OrderFields({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <>
      <GraphField label="Order" icon={ArrowDownUp}>
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
      <GraphField label="Show" icon={Eye}>
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
