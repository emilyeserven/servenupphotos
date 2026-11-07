import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Palette } from "lucide-react";
import { useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import {
  type ColorPickerProps,
  ColorPickerPart,
  type ColorSection,
} from "@portfolio/components/color-picker-parts";
import { FilterCount } from "@portfolio/components/photo-filters";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  COLOR_FILTER_KEYS,
  type ColorFilters,
  colorFilterCount,
  DEFAULT_PERCENT,
} from "@portfolio/lib/color-search";
import { type ColorName, colorLabel, colorSwatch, isShade } from "@portfolio/lib/photo-colors";
import { cn } from "@portfolio/lib/utils";

/** What each section of the picker is set to, shown under its name in the left list. */
const SECTIONS: [ColorSection, string, (filters: ColorFilters) => string][] = [
  ["color", "Color", ({ color }) => (color ? colorLabel(color) : "Any")],
  ["match", "Match", matchText],
  ["vivid", "Vividness", vividText],
];

/** How photos match the color, such as "Largest color" or "At least 30%". */
function matchText({ match, min = DEFAULT_PERCENT }: ColorFilters): string {
  return match === "threshold" ? `At least ${min}%` : "Largest color";
}

/** The vividness measure and the least a photo needs, such as "Peak · 40+". */
function vividText({ vivid, measure = "average" }: ColorFilters): string {
  const name = measure === "peak" ? "Peak" : "Average";
  return vivid ? `${name} · ${vivid}+` : `${name} · any`;
}

/** The section to open the picker on: vividness when only it is set, otherwise the color. */
function firstSection(filters: ColorFilters): ColorSection {
  return filters.vivid && !filters.color ? "vivid" : "color";
}

/**
 * The Grid's **Colors** filter, a button like **When** and **Camera** that opens a picker: a list
 * of Color, Match and Vividness on the left, each saying what it's set to, and the chosen one's
 * controls on the right, with what each choice does. The button shows the picked color and how
 * many color filters are set. `photos` is what the other filters leave, which the swatches'
 * counts are out of.
 */
export function GridColorFilters(props: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <Palette className="text-muted-foreground" aria-hidden />
          Colors
          <PickedDot color={props.filters.color} />
          <FilterCount count={colorFilterCount(props.filters)} />
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(32rem,calc(100vw-2rem))] p-0"
      >
        <PickerBody {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** A small dot of the picked color in the button, so it shows while the picker is closed. */
function PickedDot({ color }: { color: ColorName | undefined }) {
  if (!color) return null;
  return (
    <span
      title={colorLabel(color)}
      className={cn("size-3 rounded-full", isShade(color) && "ring-1 ring-border")}
      style={{ backgroundColor: colorSwatch(color) }}
    />
  );
}

/** The list of sections on the left, with **Clear** under it, and the chosen one on the right. */
function PickerBody(props: ColorPickerProps) {
  const [section, setSection] = useState<ColorSection>(() => firstSection(props.filters));
  return (
    <div className="flex max-h-[min(28rem,70vh)]">
      <div className="flex w-28 shrink-0 flex-col gap-0.5 border-r bg-muted/40 p-1 sm:w-36">
        <div role="tablist" aria-orientation="vertical" aria-label="Color filters">
          {SECTIONS.map(([key, label, text]) => (
            <SectionTab
              key={key}
              label={label}
              text={text(props.filters)}
              chosen={section === key}
              onClick={() => setSection(key)}
            />
          ))}
        </div>
        <ClearColors filters={props.filters} />
      </div>
      <div role="tabpanel" className="min-w-0 flex-1 overflow-y-auto p-3">
        <ColorPickerPart section={section} {...props} />
      </div>
    </div>
  );
}

/** A section in the left list: its name, with what it's set to under it. */
function SectionTab({
  label,
  text,
  chosen,
  onClick,
}: {
  label: string;
  text: string;
  chosen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={chosen}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        chosen && "bg-background shadow-xs",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="w-full truncate text-xs text-muted-foreground">{text}</span>
    </button>
  );
}

/** An X under the list clearing every color filter, shown while any is set. */
function ClearColors({ filters }: { filters: ColorFilters }) {
  const navigate = useNavigate();
  if (colorFilterCount(filters) === 0) return null;
  const clear = () =>
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...Object.fromEntries(COLOR_FILTER_KEYS.map((key) => [key, undefined])),
      }),
      replace: true,
    });
  return (
    <div className="mt-auto flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground">
      Clear colors
      <ClearFilterButton label="Colors" onClear={clear} />
    </div>
  );
}
