import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { ColorName } from "@/lib/photo-colors";
import { cn } from "@/lib/utils";

/** What a swatch on the Color page sets in the URL: a color, or a gray step of the Black & white view. */
interface SwatchSearch {
  color?: ColorName;
  shade?: number;
}

const SWATCH_CLASS =
  "flex size-8 items-center justify-center rounded-full border-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The **All** button before a row of swatches, which clears them. */
export function AllSwatch({ active, clear }: { active: boolean; clear: SwatchSearch }) {
  return (
    <Link
      from="/color"
      to="/color"
      search={(prev) => ({ ...prev, ...clear, photo: undefined })}
      replace
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      All
    </Link>
  );
}

/**
 * A round swatch of fill that sets pick in the URL, or clears it with clear when it's already
 * picked (active), outlined then. One with no photos can't be picked, and is crossed out, unless
 * it's already picked (from a link), so it can be cleared.
 */
export function FilterSwatch({
  fill,
  ringed,
  label,
  count,
  active,
  pick,
  clear,
}: {
  fill: string;
  /** Whether the dot gets a thin ring, so white and the light grays show. */
  ringed: boolean;
  label: string;
  /** How many photos picking it would show. */
  count: number;
  active: boolean;
  pick: SwatchSearch;
  clear: SwatchSearch;
}) {
  const title = `${label}: ${count} photos`;
  const dot = <SwatchDot fill={fill} ringed={ringed} />;
  if (count === 0 && !active) return <UnavailableSwatch title={title}>{dot}</UnavailableSwatch>;
  return (
    <Link
      from="/color"
      to="/color"
      search={(prev) => ({ ...prev, ...(active ? clear : pick), photo: undefined })}
      replace
      aria-pressed={active}
      aria-label={title}
      title={title}
      className={cn(SWATCH_CLASS, active ? "border-foreground" : "border-transparent")}
    >
      {dot}
    </Link>
  );
}

/** A swatch that can't be picked, as no photo would show: crossed out with an X. */
function UnavailableSwatch({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span
      role="img"
      aria-label={`${title}, can't be picked`}
      title={title}
      className={cn(SWATCH_CLASS, "relative cursor-not-allowed border-transparent")}
    >
      {children}
      <X
        aria-hidden
        strokeWidth={3}
        className="absolute size-5 text-white drop-shadow-[0_0_1.5px_black]"
      />
    </span>
  );
}

/** The colored dot inside a swatch. */
function SwatchDot({ fill, ringed }: { fill: string; ringed: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-6 rounded-full", ringed && "ring-1 ring-border")}
      style={{ backgroundColor: fill }}
    />
  );
}
