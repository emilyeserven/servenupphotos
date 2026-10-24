import { type HueShare, hueLabel, hueSwatch, percent } from "@/lib/photo-colors";

/** How many of the biggest hues are named under the bar. */
const NAMED = 3;

/**
 * A photo's colors as one bar, each hue bucket as wide as its share of the colored pixels, with
 * the biggest few named under it. Blacks, grays and whites are left out.
 */
export function HueBar({ hues }: { hues: HueShare[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={hues.map((h) => `${hueLabel(h.hue)} ${percent(h.share)}`).join(", ")}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {hues.map((h) => (
          <span
            key={h.hue}
            title={`${hueLabel(h.hue)} ${percent(h.share)}`}
            style={{ width: `${h.share * 100}%`, backgroundColor: hueSwatch(h.hue) }}
          />
        ))}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {hues
          .slice(0, NAMED)
          .map((h) => `${hueLabel(h.hue)} ${percent(h.share)}`)
          .join(" · ")}
      </p>
    </div>
  );
}
