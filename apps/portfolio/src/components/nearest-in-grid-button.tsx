import { Link } from "@tanstack/react-router";
import { Crosshair } from "lucide-react";
import type { LngLatBounds } from "maplibre-gl";
import { pointText } from "@/lib/distance-sort";
import type { PhotoFilters } from "@/lib/photo-filters";
import { cn } from "@/lib/utils";
import { rememberedViewOptions } from "@/lib/view-options";

/**
 * A **Nearest here** button that opens the Grid sorted by **Distance** from the middle of the map's
 * view (`?sort=distance&near=35.6762,139.6503`), keeping the map's filters but not what's in view,
 * so every photo is there, nearest first. It can't be pressed before the map is drawn.
 */
export function NearestInGridButton({
  filters,
  view,
}: {
  filters: PhotoFilters;
  view: LngLatBounds | null;
}) {
  const center = view?.getCenter();
  const near = center && pointText({ latitude: center.lat, longitude: center.lng });
  return (
    <Link
      to="/grid"
      search={() => ({
        ...rememberedViewOptions("/grid"),
        ...filters,
        sort: "distance" as const,
        order: undefined,
        near,
      })}
      disabled={!near}
      title="See every photo in the Grid, nearest the middle of the map first"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input",
        !near && "pointer-events-none opacity-50",
      )}
    >
      <Crosshair className="size-4 text-muted-foreground" aria-hidden />
      {/* Just the icon on phones, so the map's controls fit on one row. */}
      <span className="max-md:sr-only">Nearest here</span>
    </Link>
  );
}
