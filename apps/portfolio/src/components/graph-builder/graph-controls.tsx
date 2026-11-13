import { AxesPicker } from "@portfolio/components/graph-builder/axes-picker";
import { GraphTypePicker } from "@portfolio/components/graph-builder/graph-type-picker";
import { RangePicker } from "@portfolio/components/graph-builder/range-picker";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import type { Photo } from "@portfolio/lib/photos";

/** A change to some of the graph's settings. */
export type ConfigChange = (change: Partial<GraphConfig>) => void;

/**
 * The graph's settings, in the Adjust Graph box, as three buttons that each open a picker, the
 * data first: **Axes** (what's along each axis, and the x axis's order), **Graph type** (its type,
 * with the ones that suit the axes marked, and what splits a bar, line or photo dot graph) and **Range** (each axis's ends, how many values show, the photos
 * a value needs, empty ends, and buckets).
 */
export function GraphControls({
  config,
  onChange,
  list,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the Range picker's choices and the type suggestion are read from; every photo when left out. */
  list?: Photo[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AxesPicker config={config} onChange={onChange} />
      <GraphTypePicker config={config} onChange={onChange} list={list} />
      <RangePicker config={config} onChange={onChange} list={list} />
    </div>
  );
}
