import { FilterSwatch } from "@portfolio/components/filter-swatch";
import {
  type ColorName,
  colorLabel,
  colorSwatch,
  HUE_BUCKETS,
  isShade,
  SHADES,
} from "@portfolio/lib/photo-colors";

/**
 * A swatch for each hue bucket, six to a row, and then the shades on a row of their own below, to
 * show only the photos with much of that color, kept in the URL as `?color=` so a link keeps it.
 * Picking the chosen one again clears it.
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
    <div role="group" aria-label="Filter by color" className="flex flex-col gap-3">
      <div className="grid w-max grid-cols-6 gap-2">
        {HUE_BUCKETS.map((option) => (
          <ColorSwatch
            key={option}
            color={option}
            active={color === option}
            count={counts[option]}
          />
        ))}
      </div>
      <div className="flex gap-2 border-t pt-3">
        {SHADES.map((option) => (
          <ColorSwatch
            key={option}
            color={option}
            active={color === option}
            count={counts[option]}
          />
        ))}
      </div>
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
