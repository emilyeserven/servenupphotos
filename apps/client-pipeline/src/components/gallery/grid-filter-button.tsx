import { FilterIcon } from "lucide-react";
import { GridFilterBar } from "@/components/gallery/grid-filters";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Photo } from "@portfolio/lib/photos";

/**
 * **Filter**, saying how many of the portfolio Grid's filters are set, which opens them in a
 * flyout, for a panel with no room to show them inline, such as the Photo Book's photo drawer.
 * `photos` is what the counts are out of.
 */
export function GridFilterButton({ photos, count }: { photos: Photo[]; count: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? "secondary" : "outline"}
          size="sm"
          disabled={photos.length === 0}
        >
          <FilterIcon />
          Filter
          {count > 0 && <span className="tabular-nums">· {count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[75vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <GridFilterBar photos={photos} bare />
      </PopoverContent>
    </Popover>
  );
}
