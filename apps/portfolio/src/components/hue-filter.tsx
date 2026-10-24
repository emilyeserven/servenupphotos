import { Link } from "@tanstack/react-router";
import { HUE_BUCKETS, type HueBucket, hueLabel, hueSwatch } from "@/lib/photo-colors";
import { cn } from "@/lib/utils";

const SWATCH_CLASS =
  "flex size-8 items-center justify-center rounded-full border-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A swatch for each hue bucket to show only the photos with much of that color, and one to show
 * every photo again, kept in the URL as `?hue=` so a link keeps it.
 */
export function HueFilter({
  hue,
  counts,
}: {
  hue: HueBucket | undefined;
  /** How many photos each swatch would show. */
  counts: Record<HueBucket, number>;
}) {
  return (
    <div role="group" aria-label="Filter by color" className="flex flex-wrap items-center gap-2">
      <Link
        from="/color"
        to="/color"
        search={(prev) => ({ ...prev, hue: undefined, photo: undefined })}
        replace
        aria-pressed={!hue}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hue ? "text-muted-foreground hover:text-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        All
      </Link>
      {HUE_BUCKETS.map((option) => (
        <HueSwatch key={option} hue={option} active={hue === option} count={counts[option]} />
      ))}
    </div>
  );
}

/** One hue bucket's swatch, outlined when it's the filter. */
function HueSwatch({ hue, active, count }: { hue: HueBucket; active: boolean; count: number }) {
  const label = `${hueLabel(hue)}: ${count} photos`;
  return (
    <Link
      from="/color"
      to="/color"
      search={(prev) => ({ ...prev, hue: active ? undefined : hue, photo: undefined })}
      replace
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(SWATCH_CLASS, active ? "border-foreground" : "border-transparent")}
    >
      <span
        aria-hidden
        className={cn("size-6 rounded-full", count === 0 && "opacity-30")}
        style={{ backgroundColor: hueSwatch(hue) }}
      />
    </Link>
  );
}
