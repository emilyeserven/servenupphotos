import { Link } from "@tanstack/react-router";
import { Grid3x3 } from "lucide-react";
import type { PhotoFilters } from "@/lib/photo-filters";
import { cn } from "@/lib/utils";

/**
 * A **View in grid** button that opens the Grid on the filters given, such as the ones showing the
 * photos the map has in view; it can't be pressed without them.
 */
export function ViewInGridButton({ filters }: { filters: PhotoFilters | null }) {
  return (
    <Link
      to="/grid"
      search={filters ?? {}}
      disabled={!filters}
      title={filters ? "See the photos in view in the Grid" : "No photos in view"}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input",
        !filters && "pointer-events-none opacity-50",
      )}
    >
      <Grid3x3 className="size-4 text-muted-foreground" aria-hidden />
      View in grid
    </Link>
  );
}
