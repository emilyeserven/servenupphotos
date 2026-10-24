import { AllSwatch, FilterSwatch } from "@/components/filter-swatch";
import {
  type ColorName,
  colorLabel,
  colorSwatch,
  HUE_BUCKETS,
  isShade,
  SHADES,
} from "@/lib/photo-colors";

/**
 * A swatch for each hue bucket and then each shade, to show only the photos with much of that
 * color, and one to show every photo again, kept in the URL as `?color=` so a link keeps it.
 */
export function ColorFilter({
  color,
  counts,
}: {
  color: ColorName | undefined;
  /** How many photos each swatch would show. */
  counts: Record<ColorName, number>;
}) {
  return (
    <div role="group" aria-label="Filter by color" className="flex flex-wrap items-center gap-2">
      <AllSwatch active={!color} clear={{ color: undefined }} />
      {HUE_BUCKETS.map((option) => (
        <ColorSwatch key={option} color={option} active={color === option} count={counts[option]} />
      ))}
      <span aria-hidden className="mx-1 h-6 w-px bg-border" />
      {SHADES.map((option) => (
        <ColorSwatch key={option} color={option} active={color === option} count={counts[option]} />
      ))}
    </div>
  );
}

/** One hue bucket's or shade's swatch, outlined when it's the filter. */
function ColorSwatch({
  color,
  active,
  count,
}: {
  color: ColorName;
  active: boolean;
  count: number;
}) {
  return (
    <FilterSwatch
      fill={colorSwatch(color)}
      ringed={isShade(color)}
      label={colorLabel(color)}
      count={count}
      active={active}
      pick={{ color }}
      clear={{ color: undefined }}
    />
  );
}
