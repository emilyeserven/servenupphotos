import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  type ColorName,
  colorLabel,
  colorSwatch,
  HUE_BUCKETS,
  isShade,
  SHADES,
} from "@/lib/photo-colors";
import { cn } from "@/lib/utils";

const SWATCH_CLASS =
  "flex size-8 items-center justify-center rounded-full border-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
      <Link
        from="/color"
        to="/color"
        search={(prev) => ({ ...prev, color: undefined, photo: undefined })}
        replace
        aria-pressed={!color}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          color
            ? "text-muted-foreground hover:text-foreground"
            : "bg-accent text-accent-foreground",
        )}
      >
        All
      </Link>
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

/**
 * One hue bucket's or shade's swatch, outlined when it's the filter. A color no photo has much of
 * can't be picked, and is crossed out, unless it's already the filter (from a link), so it can be
 * cleared.
 */
function ColorSwatch({
  color,
  active,
  count,
}: {
  color: ColorName;
  active: boolean;
  count: number;
}) {
  const label = `${colorLabel(color)}: ${count} photos`;
  if (count === 0 && !active) return <UnavailableSwatch color={color} label={label} />;
  return (
    <Link
      from="/color"
      to="/color"
      search={(prev) => ({ ...prev, color: active ? undefined : color, photo: undefined })}
      replace
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(SWATCH_CLASS, active ? "border-foreground" : "border-transparent")}
    >
      <SwatchDot color={color} />
    </Link>
  );
}

/** A swatch that can't be picked, as no photo has much of its color: crossed out with an X. */
function UnavailableSwatch({ color, label }: { color: ColorName; label: string }) {
  return (
    <span
      role="img"
      aria-label={`${label}, can't be picked`}
      title={label}
      className={cn(SWATCH_CLASS, "relative cursor-not-allowed border-transparent")}
    >
      <SwatchDot color={color} />
      <X
        aria-hidden
        strokeWidth={3}
        className="absolute size-5 text-white drop-shadow-[0_0_1.5px_black]"
      />
    </span>
  );
}

/** The color's dot inside a swatch, ringed for shades so white and the light grays show. */
function SwatchDot({ color }: { color: ColorName }) {
  return (
    <span
      aria-hidden
      className={cn("size-6 rounded-full", isShade(color) && "ring-1 ring-border")}
      style={{ backgroundColor: colorSwatch(color) }}
    />
  );
}
