import { Crop } from "lucide-react";
import type { ReactNode } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { xName } from "@portfolio/components/graph-builder/axes-picker";
import {
  GraphPicker,
  type GraphPickerSection,
} from "@portfolio/components/graph-builder/graph-picker";
import {
  BucketChoices,
  bucketText,
  withValue,
} from "@portfolio/components/graph-builder/bucket-choices";
import { XEnds, YEnds } from "@portfolio/components/graph-builder/graph-ranges";
import {
  axisValues,
  type GraphConfig,
  hasYStat,
  xBuckets,
  yBuckets,
} from "@portfolio/lib/graph-data";
import { photoCounts } from "@portfolio/lib/graph-ranges";
import { type Photo, photos as allPhotos } from "@portfolio/lib/photos";
import type { StatRow } from "@portfolio/lib/stat-groups";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** One section of the Range picker. */
type RangeSection = "x" | "y" | "photos" | "show" | "empty" | "xBuckets" | "yBuckets";

/** How many of the x axis's values can be shown; 0 is all. */
const LIMITS = [0, 5, 10, 20];

/** Two ends as text, such as "f/2 – f/8"; All while both are the axis's own. */
function endsText(from: string | number | null, to: string | number | null, start: string) {
  if (from === null && to === null) return "All";
  return `${endOr(from, start)} – ${endOr(to, "End")}`;
}

/** An end as text, or the axis's own end's name while it's off. */
function endOr(end: string | number | null, own: string): string {
  return end === null ? own : String(end);
}

/** What the y axis's ends say: a scatterplot's or heatmap's values, or a bar, line or dot graph's numbers. */
function yText(config: GraphConfig): string {
  if (hasYStat(config.type)) return endsText(config.yFrom, config.yTo, "Start");
  return endsText(config.yMin, config.yMax, "0");
}

/** A size of the x axis's first values as text. */
function showText(limit: number): string {
  return limit === 0 ? "All" : `First ${limit}`;
}

/** The graph types with no y axis ends to pick: the pie, and the photo dot graph, whose stacks are as tall as they are. */
const NO_Y_ENDS: ReadonlySet<GraphConfig["type"]> = new Set(["pie", "photos"]);

/** The y axis's ends, off a pie or photo dot graph. */
function ySections(config: GraphConfig): GraphPickerSection<RangeSection>[] {
  return NO_Y_ENDS.has(config.type) ? [] : [["y", "Y axis", yText(config)]];
}

/** The y axis's buckets, for a scatterplot's or heatmap's second stat. */
function yBucketSections(config: GraphConfig): GraphPickerSection<RangeSection>[] {
  return hasYStat(config.type)
    ? [["yBuckets", "Y axis buckets", bucketText(yBuckets(config))]]
    : [];
}

/** The picker's sections, each with what it's set to. */
function sectionsOf(config: GraphConfig): GraphPickerSection<RangeSection>[] {
  const x = xName(config);
  return [
    ["x", x, endsText(config.xFrom, config.xTo, "Start")],
    ...ySections(config),
    ["photos", "Photos per value", config.minPhotos > 0 ? `At least ${config.minPhotos}` : "Any"],
    ["show", "Show", showText(config.limit)],
    ["empty", "Empty ends", config.hideZeros ? "Trimmed" : "Kept"],
    ["xBuckets", `${x} buckets`, bucketText(xBuckets(config))],
    ...yBucketSections(config),
  ];
}

interface RangeProps {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the choices are read from: the ones the filters keep, or else every photo. */
  list?: Photo[];
}

/**
 * The **Range** button, like **Graph type**: the first and last value on each axis, how many photos
 * an x value needs, how many of the x axis's values show, whether the empty values at its ends are
 * trimmed, and how many values each bucket of an axis puts together. Each is picked from what the
 * photos the filters keep have.
 */
export function RangePicker({ config, onChange, list = allPhotos }: RangeProps) {
  return (
    <GraphPicker label="Range" Icon={Crop} sections={sectionsOf(config)}>
      {(section) => (
        <RangeChoices
          section={section}
          config={config}
          onChange={onChange}
          list={list}
          rows={axisValues(list, config)}
        />
      )}
    </GraphPicker>
  );
}

interface ChoicesProps {
  section: RangeSection;
  config: GraphConfig;
  onChange: ConfigChange;
  list: Photo[];
  /** The x axis's values, in buckets when it has them. */
  rows: StatRow[];
}

/** Each section's controls. */
const PARTS: Record<RangeSection, (props: ChoicesProps) => ReactNode> = {
  x: ({ config, rows, onChange }) => (
    <XEnds name={xName(config)} rows={rows} config={config} onChange={onChange} />
  ),
  y: (props) => <YEnds {...props} />,
  photos: ({ config, rows, onChange }) => (
    <PhotoChoices
      value={config.minPhotos}
      rows={rows}
      onPick={(minPhotos) => onChange({ minPhotos })}
    />
  ),
  show: ({ config, onChange }) =>
    LIMITS.map((limit) => (
      <ChoiceRow
        key={limit}
        label={showText(limit)}
        on={config.limit === limit}
        onClick={() => onChange({ limit })}
      />
    )),
  empty: ({ config, onChange }) => (
    <>
      <ChoiceRow
        label="Keep them"
        on={!config.hideZeros}
        onClick={() => onChange({ hideZeros: false })}
      />
      <ChoiceRow
        label="Trim them"
        on={config.hideZeros}
        onClick={() => onChange({ hideZeros: true })}
      />
    </>
  ),
  xBuckets: ({ config, list, onChange }) => (
    <BucketChoices
      buckets={xBuckets(config)}
      list={list}
      onPick={(xBucket, xWidth) => onChange({ xBucket, xWidth, xFrom: null, xTo: null })}
    />
  ),
  yBuckets: ({ config, list, onChange }) => (
    <BucketChoices
      buckets={yBuckets(config)}
      list={list}
      onPick={(yBucket, yWidth) => onChange({ yBucket, yWidth, yFrom: null, yTo: null })}
    />
  ),
};

/** The chosen section's controls. */
function RangeChoices(props: ChoicesProps) {
  return PARTS[props.section](props);
}

/** Any, or at least one of the photo counts the x values have; a picked count no longer there is kept. */
function PhotoChoices({
  value,
  rows,
  onPick,
}: {
  value: number;
  rows: StatRow[];
  onPick: (count: number) => void;
}) {
  const counts = withValue(
    photoCounts(rows).filter((count) => count > 1),
    value,
  );
  return (
    <>
      <ChoiceRow label="Any" on={value === 0} onClick={() => onPick(0)} />
      {counts.map((count) => (
        <ChoiceRow
          key={count}
          label={`At least ${count}`}
          on={value === count}
          onClick={() => onPick(count)}
        />
      ))}
    </>
  );
}
