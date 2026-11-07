import { ChoiceRow } from "@portfolio/components/choice-row";
import { evenText, evenWidths } from "@portfolio/lib/even-buckets";
import { type AxisBuckets, bucketChoices } from "@portfolio/lib/graph-buckets";
import { statById } from "@portfolio/lib/graph-data";
import type { Photo } from "@portfolio/lib/photos";

/** A bucket size as text. */
function sizeText(size: number): string {
  return size > 1 ? `Every ${size} values` : "Each value";
}

/** What an axis's buckets are set to, such as "Every 2 values" or "Even ranges of 1 stop". */
export function bucketText({ stat, size, width }: AxisBuckets): string {
  return width > 0 ? evenText(stat, width) : sizeText(size);
}

/** The choices with the picked one added, in order, when it's set and not among them. */
export function withValue(choices: number[], value: number): number[] {
  if (value <= 0 || choices.includes(value)) return choices;
  return [...choices, value].toSorted((a, b) => a - b);
}

/**
 * An axis's bucket choices: each value, every 2, 3 … values (under how many values the axis has),
 * and for a camera setting, even ranges such as 1 or 2 stops or 25 mm wide. Picking one sets
 * `size` and `width` together, the other one off.
 */
export function BucketChoices({
  buckets,
  list,
  onPick,
}: {
  buckets: AxisBuckets;
  list: Photo[];
  onPick: (size: number, width: number) => void;
}) {
  const { stat, size, width } = buckets;
  const values = statById(stat).build(list).rows.length;
  const sizes = withValue(bucketChoices(values), width > 0 ? 0 : size);
  return (
    <>
      {sizes.map((each) => (
        <ChoiceRow
          key={`size-${each}`}
          label={sizeText(each)}
          on={width === 0 && size === each}
          onClick={() => onPick(each, 0)}
        />
      ))}
      {evenWidths(stat).map((each) => (
        <ChoiceRow
          key={`width-${each}`}
          label={evenText(stat, each)}
          on={width === each}
          onClick={() => onPick(0, each)}
        />
      ))}
    </>
  );
}
