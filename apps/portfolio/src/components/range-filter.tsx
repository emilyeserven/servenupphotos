import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { parseRange } from "@/lib/table-filters";
import { cn } from "@/lib/utils";

/** A range a slider can be set to in one click, from a metadata group such as **Wide angle**. */
export interface RangePreset {
  /** The metadata group's ID. */
  id: string;
  name: string;
  /** The range the group covers as a photographer writes it, such as "10–24mm". */
  span: string;
  /** The range it sets, as "low-high" of the values the photos have. */
  range: string;
}

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
 * when the handles are back at the ends. `presets` are the metadata groups of the setting, each a
 * button under the slider that sets it to the group's range, or clears it when it's already set.
 */
export function RangeFilter({
  label,
  values,
  range,
  write,
  presets,
  onChange,
}: {
  label: string;
  values: string[];
  range: string | undefined;
  write: (value: string) => string;
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
      <RangePresets presets={presets} range={range} onChange={onChange} />
    </div>
  );
}

/** A button for each preset, pressed while the slider is set to its range. */
function RangePresets({
  presets,
  range,
  onChange,
}: {
  presets: RangePreset[];
  range: string | undefined;
  onChange: (range: string | undefined) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset) => {
        const pressed = preset.range === range;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? undefined : preset.range)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs whitespace-nowrap outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              pressed && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {preset.name}{" "}
            <span className={cn("tabular-nums", !pressed && "text-muted-foreground")}>
              {preset.span}
            </span>
          </button>
        );
      })}
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
