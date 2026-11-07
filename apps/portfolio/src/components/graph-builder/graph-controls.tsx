import { AxesPicker } from "@portfolio/components/graph-builder/axes-picker";
import { GraphTypePicker } from "@portfolio/components/graph-builder/graph-type-picker";
import { RangePicker } from "@portfolio/components/graph-builder/range-picker";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import type { Photo } from "@portfolio/lib/photos";

/** A change to some of the graph's settings. */
export type ConfigChange = (change: Partial<GraphConfig>) => void;

/**
<<<<<<< HEAD
 * The graph's settings, in the Adjust Graph box, as three buttons that each open a picker:
 * **Graph type** (its type, and what splits a bar, line or photo dot graph), **Axes** (what's along each
 * axis, and the x axis's order) and **Range** (each axis's ends, how many values show, the photos
 * a value needs, empty ends, and buckets).
=======
 * The graph's settings, in the Adjust Graph box: its type, what's on each axis, what splits a bar,
 * line graph, the x axis's order and how many of its values show, and the Range group.
>>>>>>> origin/claude/project-thread-907vy7
 */
export function GraphControls({
  config,
  onChange,
  list,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the Range picker's choices are read from; every photo when left out. */
  list?: Photo[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GraphTypePicker config={config} onChange={onChange} />
      <AxesPicker config={config} onChange={onChange} />
      <RangePicker config={config} onChange={onChange} list={list} />
    </div>
  );
}
<<<<<<< HEAD
=======

/** What a bar, line or pie graph can measure, as a dropdown's options. */
export function MeasureOptions() {
  return (
    <>
      <option value="count">Photos</option>
      <option value="percent">Share of photos (%)</option>
    </>
  );
}

/**
 * The y axis: another stat for a scatterplot or heatmap, nothing for a photo dot graph, whose stacks
 * are always photos, or what's measured for the rest.
 */
function YField({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (config.type === "photos") return null;
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
>>>>>>> origin/claude/project-thread-907vy7
