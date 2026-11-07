import { Group } from "lucide-react";
import { GraphField } from "@portfolio/components/graph-builder/graph-field";
import { bucketChoices } from "@portfolio/lib/graph-buckets";
import { type GraphConfig, hasYStat, statById } from "@portfolio/lib/graph-data";
import { type Photo, photos as allPhotos } from "@portfolio/lib/photos";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

interface BucketsProps {
  config: GraphConfig;
  onChange: ConfigChange;
  /** The photos the choices are read from: the ones the filters keep, or else every photo. */
  list?: Photo[];
}

/**
 * The Buckets group in the Adjust Graph box: how many of the x axis's values each bucket puts
 * together, in the axis's own order, such as every 2 for f/1.4 – f/2, and the same for a
 * scatterplot's or heatmap's y axis. Each offers only sizes under how many values the axis has.
 */
export function GraphBuckets({ config, onChange, list = allPhotos }: BucketsProps) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">Buckets</legend>
      <BucketSelect
        label={config.type === "pie" ? "Slices" : "X axis"}
        values={statById(config.x).build(list).rows.length}
        value={config.xBucket}
        onChange={(xBucket) => onChange({ xBucket, xFrom: null, xTo: null })}
      />
      {hasYStat(config.type) && (
        <BucketSelect
          label="Y axis"
          values={statById(config.y).build(list).rows.length}
          value={config.yBucket}
          onChange={(yBucket) => onChange({ yBucket, yFrom: null, yTo: null })}
        />
      )}
    </fieldset>
  );
}

/** One axis's bucket size: Off, or every 2, 3 … values; a picked size no longer offered is kept. */
function BucketSelect({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  /** How many values the axis has. */
  values: number;
  value: number;
  onChange: (size: number) => void;
}) {
  const sizes = bucketChoices(values);
  const shown = sizes.includes(value) ? sizes : [...sizes, value];
  return (
    <GraphField label={label} icon={Group}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SELECT_CLASS}
      >
        {shown.map((size) => (
          <option key={size} value={size}>
            {size === 0 ? "Each value" : `Every ${size} values`}
          </option>
        ))}
      </select>
    </GraphField>
  );
}
