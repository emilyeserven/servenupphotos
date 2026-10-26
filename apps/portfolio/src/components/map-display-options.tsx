import { Eye } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_MAP_DISPLAY,
  GROUPING_RANGE,
  type MapDisplay,
  type PinSize,
} from "@/lib/map-display";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** The pin sizes in the order the options list them, with their labels. */
const PIN_SIZES: [PinSize, string][] = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
];

/**
 * An eye button over the map that opens its display options in a flyout: how readily photos are
 * grouped, how big the pins are, whether groups show their counts, and whether a group's photos
 * are darkened under the count.
 */
export function MapDisplayOptions({
  display,
  onChange,
}: {
  display: MapDisplay;
  onChange: (change: Partial<MapDisplay>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Display options"
          aria-label="Display options"
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-input"
        >
          <Eye className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-4 p-3 text-sm">
        <GroupingSlider
          grouping={display.grouping}
          onChange={(grouping) => onChange({ grouping })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Pin size</span>
          <div className={CONTROL_FRAME} role="group" aria-label="Pin size">
            {PIN_SIZES.map(([size, label]) => (
              <button
                key={size}
                type="button"
                aria-pressed={display.pinSize === size}
                onClick={() => onChange({ pinSize: size })}
                className={controlButtonClass(display.pinSize === size)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox
            label="Show counts on groups"
            checked={display.showCounts}
            onChange={(showCounts) => onChange({ showCounts })}
          />
          <Checkbox
            label="Darken photos under counts"
            checked={display.dimGroups}
            onChange={(dimGroups) => onChange({ dimGroups })}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_MAP_DISPLAY)}
          className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Reset to defaults
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A slider for how close photos are before they're grouped, from **Less** (more photos on their
 * own) to **More**. It changes the map once let go, as regrouping every photo while dragging is slow.
 */
function GroupingSlider({
  grouping,
  onChange,
}: {
  grouping: number;
  onChange: (grouping: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Grouping</span>
        <span className="tabular-nums">{dragging ?? grouping} px</span>
      </div>
      <Slider
        min={GROUPING_RANGE.min}
        max={GROUPING_RANGE.max}
        step={GROUPING_RANGE.step}
        value={[dragging ?? grouping]}
        aria-label="Grouping"
        onValueChange={([value]) => setDragging(value ?? null)}
        onValueCommit={([value]) => {
          setDragging(null);
          if (value !== undefined) onChange(value);
        }}
        className="py-1"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Less</span>
        <span>More</span>
      </div>
    </div>
  );
}

/** A labelled checkbox for one of the options. */
function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      {label}
    </label>
  );
}
