import { useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { Slider } from "@portfolio/components/ui/slider";
import { parseRange } from "@portfolio/lib/camera-filters";
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

/** Where the handles sit: where they're dragged, else at the previewed range, else at the set one. */
function shownPositions(
  values: string[],
  range: string | undefined,
  preview: string | undefined,
  dragging: number[] | null,
): number[] {
  return dragging ?? positionsOf(values, preview ?? range);
}

/** The range the URL keeps for the positions, such as "100-400"; undefined when it's every value. */
function rangeOf(values: string[], [low = 0, high = 0]: number[]): string | undefined {
  const every = low === 0 && high === values.length - 1;
  return every ? undefined : `${values[low]}-${values[high]}`;
}

/**
 * A slider with a handle at each end, with a tick under it for each step and its lowest and highest
 * values at its ends, narrowing the photos to a range of one camera setting. It
 * steps through `values`, the ones the photos have, lowest first, so each step shows a different
 * set of photos; `write` writes one the way a photographer does, such as "f/5.6". `range` is the
 * one set, as "low-high", and `preview`, when given, a range the handles show for now without setting it,
 * such as the quick pick pointed at. `onChange` gets the new one once a handle is let go, or undefined
 * when the handles are back at the ends or its X is clicked. Its quick picks are listed apart, by `RangePresetList`. `writeHigh`, when given, writes the range's
 * high end instead, such as the last minute of an hour.
 */
export function RangeFilter({
  label,
  values,
  range,
  preview,
  write,
  writeHigh = write,
  onDrag,
  onChange,
}: {
  label: string;
  values: string[];
  range: string | undefined;
  /** A range to show the handles at for now, such as a quick pick's while it's pointed at. */
  preview?: string;
  write: (value: string) => string;
  writeHigh?: (value: string) => string;
  /** Gets the ends' values while a handle is dragged, and undefined once it's let go. */
  onDrag?: (ends: [string, string] | undefined) => void;
  onChange: (range: string | undefined) => void;
}) {
  // While a handle is dragged, the text follows it; the URL changes once it's let go.
  const [dragging, setDragging] = useState<number[] | null>(null);
  const [low = 0, high = 0] = shownPositions(values, range, preview, dragging);
  return (
    <div role="group" aria-label={label} className="flex w-full flex-col gap-2">
      <div className="flex h-5 items-center gap-1 text-sm">
        <span className="font-medium whitespace-nowrap tabular-nums">
          <RangeText
            from={endText(values, low, write)}
            to={endText(values, high, writeHigh)}
            empty={values.length === 0}
          />
        </span>
        {range && <ClearFilterButton label={label} onClear={() => onChange(undefined)} />}
      </div>
      <Slider
        min={0}
        max={Math.max(0, values.length - 1)}
        step={1}
        minStepsBetweenThumbs={0}
        value={[low, high]}
        disabled={values.length < 2}
        onValueChange={(next) => {
          setDragging(next);
          onDrag?.(endsAt(values, next));
        }}
        onValueCommit={(next) => {
          setDragging(null);
          onDrag?.(undefined);
          onChange(rangeOf(values, next));
        }}
        className="py-1"
      />
      <Scale values={values} write={write} writeHigh={writeHigh} />
    </div>
  );
}

/**
 * Under the slider: a tick for each value it steps through, and the lowest and highest values
 * below its ends. The ticks are inset by half a handle, so they sit under the handles' centers.
 */
function Scale({
  values,
  write,
  writeHigh,
}: {
  values: string[];
  write: (value: string) => string;
  writeHigh: (value: string) => string;
}) {
  if (values.length < 2) return null;
  const last = values.length - 1;
  return (
    <div aria-hidden className="-mt-1 flex flex-col gap-0.5">
      <div className="relative mx-2 h-1.5">
        {values.map((value, index) => (
          <span
            key={value}
            className="absolute top-0 h-full w-px bg-muted-foreground/50"
            style={{ left: `${(index / last) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{write(values[0] ?? "")}</span>
        <span>{writeHigh(values[last] ?? "")}</span>
      </div>
    </div>
  );
}

/** The values at the handles' positions. */
function endsAt(values: string[], [low = 0, high = 0]: number[]): [string, string] {
  return [values[low] ?? "", values[high] ?? ""];
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
