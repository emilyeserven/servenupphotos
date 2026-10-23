import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A range a slider can be set to in one click, from a metadata group such as **Wide angle**. */
export interface RangePreset {
  /** The metadata group's ID. */
  id: string;
  name: string;
  /** The range the group covers as a photographer writes it, such as "10mm–24mm". */
  span: string;
  /** The range it sets, as "low-high" of the values the photos have. */
  range: string;
}

/**
 * A small dropdown to the right of a slider, listing its quick picks. Choosing one sets the slider
 * to its range, or clears the slider when it's already there, and closes the list. Nothing shows
 * when there are none.
 */
export function RangePresets({
  label,
  presets,
  range,
  onChange,
}: {
  label: string;
  presets: RangePreset[];
  range: string | undefined;
  onChange: (range: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  if (presets.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} quick picks`}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-56 flex-col p-1">
        {presets.map((preset) => (
          <PresetItem
            key={preset.id}
            preset={preset}
            pressed={preset.range === range}
            onClick={(pressed) => {
              onChange(pressed ? undefined : preset.range);
              setOpen(false);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** One quick pick: its name and range, with a check while the slider is set to it. */
function PresetItem({
  preset,
  pressed,
  onClick,
}: {
  preset: RangePreset;
  pressed: boolean;
  onClick: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onClick(pressed)}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
    >
      <Check aria-hidden className={cn("size-4 shrink-0", !pressed && "invisible")} />
      <span className="truncate">{preset.name}</span>
      <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {preset.span}
      </span>
    </button>
  );
}
