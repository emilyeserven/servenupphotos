import { type ColorShare, colorLabel, colorSwatch, percent } from "@/lib/photo-colors";

/** How many of the biggest colors are named under the bar. */
const NAMED = 3;

/**
 * A photo's colors as one bar, each hue bucket and shade as wide as its share of the photo, with
 * the biggest few named under it.
 */
export function ColorBar({ palette }: { palette: ColorShare[] }) {
  const named = (c: ColorShare) => `${colorLabel(c.color)} ${percent(c.share)}`;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={palette.map(named).join(", ")}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border ring-inset"
      >
        {palette.map((c) => (
          <span
            key={c.color}
            title={named(c)}
            style={{ width: `${c.share * 100}%`, backgroundColor: colorSwatch(c.color) }}
          />
        ))}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {palette.slice(0, NAMED).map(named).join(" · ")}
      </p>
    </div>
  );
}
