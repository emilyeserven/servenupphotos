import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Palette } from "lucide-react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { ColorFilter } from "@portfolio/components/color-filter";
import { ColorMatchControl } from "@portfolio/components/color-match-control";
import { FilterCount } from "@portfolio/components/photo-filters";
import { VividnessControl } from "@portfolio/components/vividness-control";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  COLOR_FILTER_KEYS,
  type ColorFilters,
  colorFilterCount,
  countsFor,
  DEFAULT_PERCENT,
  matchOf,
  vividEnough,
} from "@portfolio/lib/color-search";
import { type ColorName, colorLabel, colorSwatch, isShade } from "@portfolio/lib/photo-colors";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";

/**
 * The Grid's **Colors** filter, a button like **When** that opens a picker: a small swatch for each
 * hue bucket and shade, then how a photo matches the picked color (its largest color, or at least a
 * share of it) and the least vividness, by average or peak. The button shows the picked color and
 * how many color filters are set. `photos` is what the other filters leave, which the swatches'
 * counts are out of.
 */
export function GridColorFilters({ photos, filters }: { photos: Photo[]; filters: ColorFilters }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <Palette className="text-muted-foreground" aria-hidden />
          Colors
          <PickedDot color={filters.color} />
          <FilterCount count={colorFilterCount(filters)} />
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 p-3"
      >
        <ColorsHeader filters={filters} />
        <ColorFilter
          color={filters.color}
          counts={countsFor(vividEnough(photos, filters), matchOf(filters))}
        />
        <MoreColorOptions filters={filters} />
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

/**
 * The picker's top line: its name, the picked color, and an X clearing every color filter while
 * any is set.
 */
function ColorsHeader({ filters }: { filters: ColorFilters }) {
  const navigate = useNavigate();
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
    <div className="flex h-5 items-center gap-2 text-xs">
      <span className="font-medium whitespace-nowrap text-muted-foreground">Colors</span>
      <span className="ml-auto whitespace-nowrap">{pickedText(filters)}</span>
      {colorFilterCount(filters) > 0 && (
        <ClearFilterButton label="Colors" onClear={clear} className="-mr-1" />
      )}
    </div>
  );
}

/** The picked color's name, or "Any" when none is picked. */
function pickedText({ color }: ColorFilters): string {
  return color ? colorLabel(color) : "Any";
}

/** The options under the swatches: how a photo matches the color, and the least vividness. */
function MoreColorOptions({ filters }: { filters: ColorFilters }) {
  const { min = DEFAULT_PERCENT, vivid = 0, measure = "average" } = filters;
  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <ColorMatchControl
        threshold={matchOf(filters).mode === "threshold"}
        percent={min}
        fallback={DEFAULT_PERCENT}
      />
      <VividnessControl vivid={vivid} measure={measure} />
    </div>
  );
}
