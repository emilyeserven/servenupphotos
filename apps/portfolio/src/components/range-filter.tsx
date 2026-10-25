import { useState } from "react";
import { ClearFilterButton } from "@/components/clear-filter-button";
import { type RangePreset, RangePresets } from "@/components/range-presets";
import { Slider } from "@/components/ui/slider";
import { parseRange } from "@/lib/camera-filters";
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
 * when the handles are back at the ends or its X is clicked. `presets` are the metadata groups of the setting, listed in a
 * dropdown to the right of the slider as quick picks. `writeHigh`, when given, writes the range's
 * high end instead, such as the last minute of an hour.
 */
export function RangeFilter({
  label,
  values,
  range,
  write,
  writeHigh = write,
  presets,
  onChange,
}: {
  label: string;
  values: string[];
  range: string | undefined;
  write: (value: string) => string;
  writeHigh?: (value: string) => string;
  presets: RangePreset[];
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
      <div className="flex h-5 items-center justify-between gap-2 text-xs">
        <span className="font-medium whitespace-nowrap text-muted-foreground">{label}</span>
        <span className="ml-auto whitespace-nowrap tabular-nums">
          <RangeText
            from={endText(values, low, write)}
            to={endText(values, high, writeHigh)}
            empty={values.length === 0}
          />
        </span>
        {range && (
          <ClearFilterButton label={label} onClear={() => onChange(undefined)} className="-mr-1" />
        )}
      </div>
      <div className="flex items-center gap-2">
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
        <RangePresets label={label} presets={presets} range={range} onChange={onChange} />
      </div>
    </div>
  );
}

/** The value at a position as `write` writes it, or nothing when there's none. */
function endText(values: string[], at: number, write: (value: string) => string): string {
  const value = values[at];
  return value === undefined ? "" : write(value);
}

/**
 * The range's ends as a photographer writes them, `from` and `to`, or the one value when they're
 * written the same; "None" when the photos have no values.
 */
function RangeText({ from, to, empty }: { from: string; to: string; empty: boolean }) {
  if (empty) return <span className="text-muted-foreground">None</span>;
  return <>{from === to ? from : `${from} – ${to}`}</>;
}
