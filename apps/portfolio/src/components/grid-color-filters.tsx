import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { ColorFilter } from "@portfolio/components/color-filter";
import { ColorMatchControl } from "@portfolio/components/color-match-control";
import { VividnessControl } from "@portfolio/components/vividness-control";
import {
  COLOR_FILTER_KEYS,
  type ColorFilters,
  colorFilterCount,
  countsFor,
  DEFAULT_PERCENT,
  matchOf,
  vividEnough,
} from "@portfolio/lib/color-search";
import { colorLabel } from "@portfolio/lib/photo-colors";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";

/**
 * The Grid's **Colors** filter, in its filter panel beside the camera sliders and the same size as
 * them: a small swatch for each hue bucket and shade, and a **More** toggle opening how a photo
 * matches it (its largest color, or at least a share of it) and the least vividness, by average or
 * peak, below the swatches. It starts open when any of those is set. `photos` is what the other
 * filters leave, which the swatches' counts are out of.
 */
export function GridColorFilters({ photos, filters }: { photos: Photo[]; filters: ColorFilters }) {
  const match = matchOf(filters);
  const [open, setOpen] = useState(hasMoreSet(filters));
  return (
    <section
      aria-label="Colors"
      className={cn("flex w-full flex-col gap-2 rounded-md border px-3 py-2", !open && "sm:w-auto")}
    >
      <ColorsHeader filters={filters} open={open} onToggle={() => setOpen(!open)} />
      <ColorFilter color={filters.color} counts={countsFor(vividEnough(photos, filters), match)} />
      {open && <MoreColorOptions filters={filters} />}
    </section>
  );
}

/** Whether any of the options under **More** is set, rather than left at its default. */
function hasMoreSet({ match, vivid, measure }: ColorFilters): boolean {
  return [match, vivid, measure].some((value) => value !== undefined);
}

/**
 * The Colors filter's top line, like a camera slider's: its name, the picked color, an X clearing
 * every color filter while any is set, and the **More** toggle.
 */
function ColorsHeader({
  filters,
  open,
  onToggle,
}: {
  filters: ColorFilters;
  open: boolean;
  onToggle: () => void;
}) {
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
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="-mr-1 flex items-center gap-0.5 rounded-sm px-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        More
        <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden />
      </button>
    </div>
  );
}

/** The picked color's name, or "Any" when none is picked. */
function pickedText({ color }: ColorFilters): string {
  return color ? colorLabel(color) : "Any";
}

/** The options under **More**: how a photo matches the color, and the least vividness. */
function MoreColorOptions({ filters }: { filters: ColorFilters }) {
  const { min = DEFAULT_PERCENT, vivid = 0, measure = "average" } = filters;
  return (
    <div className="flex flex-col gap-3 border-t pt-3 pb-1">
      <ColorMatchControl
        threshold={matchOf(filters).mode === "threshold"}
        percent={min}
        fallback={DEFAULT_PERCENT}
      />
      <VividnessControl vivid={vivid} measure={measure} />
    </div>
  );
}
