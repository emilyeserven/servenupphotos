import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { parseRange } from "@/lib/table-filters";

/** The value's position among the values, or `fallback` when it isn't one of them. */
function positionOf(values: string[], value: string | undefined, fallback: number): number {
  const at = value === undefined ? -1 : values.indexOf(value);
  return at === -1 ? fallback : at;
}

/** The positions of the range's ends among the values, or the ends when it isn't set. */
function positionsOf(values: string[], range: string | undefined): number[] {
  const [low, high] = parseRange(range) ?? [];
  return [positionOf(values, low, 0), positionOf(values, high, Math.max(0, values.length - 1))];
}

/** The range the URL keeps for the positions, such as "100-400"; undefined when it's every value. */
function rangeOf(values: string[], [low = 0, high = 0]: number[]): string | undefined {
  const every = low === 0 && high === values.length - 1;
  return every ? undefined : `${values[low]}-${values[high]}`;
}

/**
 * A slider with a handle at each end, narrowing the photos to a range of one camera setting. It
 * steps through `values`, the ones the photos have, lowest first, so each step shows a different
 * set of photos; `write` writes one the way a photographer does, such as "f/5.6". `range` is the
 * one set, as "low-high", and `onChange` gets the new one once a handle is let go, or undefined
 * when the handles are back at the ends.
 */
export function RangeFilter({
  label,
  values,
  range,
  write,
  onChange,
}: {
  label: string;
  values: string[];
  range: string | undefined;
  write: (value: string) => string;
  onChange: (range: string | undefined) => void;
}) {
  const committed = positionsOf(values, range);
  // While a handle is dragged, the text follows it; the URL changes once it's let go.
  const [dragging, setDragging] = useState<number[] | null>(null);
  const [low = 0, high = 0] = dragging ?? committed;
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-full flex-col sm:w-52 gap-2 rounded-md border px-3 py-2"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium whitespace-nowrap text-muted-foreground">{label}</span>
        <span className="whitespace-nowrap tabular-nums">
          <RangeText values={values} low={low} high={high} write={write} />
        </span>
      </div>
      <Slider
        min={0}
        max={Math.max(0, values.length - 1)}
        step={1}
        minStepsBetweenThumbs={0}
        value={[low, high]}
        disabled={values.length < 2}
        onValueChange={setDragging}
        onValueCommit={(next) => {
          setDragging(null);
          onChange(rangeOf(values, next));
        }}
        className="py-1"
      />
    </div>
  );
}

/** The range's ends as a photographer writes them, or the one value when they're the same. */
function RangeText({
  values,
  low,
  high,
  write,
}: {
  values: string[];
  low: number;
  high: number;
  write: (value: string) => string;
}) {
  const [from = "", to = ""] = [values[low], values[high]];
  if (values.length === 0) return <span className="text-muted-foreground">None</span>;
  return <>{from === to ? write(from) : `${write(from)} – ${write(to)}`}</>;
}
