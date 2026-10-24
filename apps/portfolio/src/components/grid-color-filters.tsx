import { ColorFilter } from "@/components/color-filter";
import { ColorMatchControl } from "@/components/color-match-control";
import { VividnessControl } from "@/components/vividness-control";
import {
  type ColorFilters,
  countsFor,
  DEFAULT_PERCENT,
  matchOf,
  vividEnough,
} from "@/lib/color-search";
import type { Photo } from "@/lib/photos";

/**
 * The Grid's **Colors** filter, in its filter panel: a swatch for each hue bucket and shade, how a
 * photo matches it (its largest color, or at least a share of it), and the least vividness, by
 * average or peak. `photos` is what the other filters leave, which the swatches' counts are out of.
 */
export function GridColorFilters({ photos, filters }: { photos: Photo[]; filters: ColorFilters }) {
  const match = matchOf(filters);
  const { min = DEFAULT_PERCENT, vivid = 0, measure = "average" } = filters;
  return (
    <section aria-label="Colors" className="flex w-full flex-col gap-3 rounded-md border p-3">
      <h2 className="text-sm font-medium">Colors</h2>
      <ColorFilter color={filters.color} counts={countsFor(vividEnough(photos, filters), match)} />
      <ColorMatchControl
        threshold={match.mode === "threshold"}
        percent={min}
        fallback={DEFAULT_PERCENT}
      />
      <VividnessControl vivid={vivid} measure={measure} />
    </section>
  );
}
