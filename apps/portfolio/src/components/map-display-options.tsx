import { useState } from "react";
import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_MAP_DISPLAY,
  GROUPING_RANGE,
  type MapDisplay,
  type PinSize,
} from "@/lib/map-display";

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
    <ViewOptionsButton onReset={() => onChange(DEFAULT_MAP_DISPLAY)}>
      <GroupingSlider grouping={display.grouping} onChange={(grouping) => onChange({ grouping })} />
      <OptionChoices
        label="Pin size"
        choices={PIN_SIZES}
        value={display.pinSize}
        onChange={(pinSize) => onChange({ pinSize })}
      />
      <div className="flex flex-col gap-2">
        <OptionCheckbox
          label="Show counts on groups"
          checked={display.showCounts}
          onChange={(showCounts) => onChange({ showCounts })}
        />
        <OptionCheckbox
          label="Darken photos under counts"
          checked={display.dimGroups}
          onChange={(dimGroups) => onChange({ dimGroups })}
        />
      </div>
    </ViewOptionsButton>
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
      <span className="text-xs font-medium text-muted-foreground">Grouping</span>
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
      <div className="relative flex justify-between text-xs text-muted-foreground">
        <DefaultTick />
        <span>Less</span>
        <span>More</span>
      </div>
    </div>
  );
}

/** Half the slider thumb's width, in pixels, which Radix keeps inside the track at either end. */
const THUMB_HALF = 8;

/**
 * A small tick under the Grouping slider where the default sits, so it's easy to get back to. It's
 * placed where the thumb's center would be at that value: Radix moves the thumb in from each end by
 * up to half its width so it stays inside the track.
 */
function DefaultTick() {
  const percent =
    ((DEFAULT_MAP_DISPLAY.grouping - GROUPING_RANGE.min) /
      (GROUPING_RANGE.max - GROUPING_RANGE.min)) *
    100;
  const inset = THUMB_HALF * (1 - percent / 50);
  return (
    <span
      aria-hidden
      title="Default"
      className="absolute -top-1.5 h-2 w-0.5 -translate-x-1/2 rounded-full bg-muted-foreground/70"
      style={{ left: `calc(${percent}% + ${inset}px)` }}
    />
  );
}
