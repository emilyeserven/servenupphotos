import { ChevronsUpDown, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";

/**
 * A **More filters** button that opens the filters it holds in a popup, such as the map's **Groups**
 * and **When** pickers, with `badge` after its label, such as how many of them are set. The
 * filters sit side by side in a row, like the Grid's filters, wrapping onto more rows on phones.
 */
export function MoreFilters({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <ListFilter className="text-muted-foreground" aria-hidden />
          {/* Just the icon on phones, so the map's controls fit on one row. */}
          <span className="max-md:sr-only">More filters</span>
          {badge}
          <ChevronsUpDown className="opacity-50 max-md:hidden" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="flex w-auto max-w-[calc(100vw-2rem)] flex-wrap items-start gap-2 p-2 [&>div]:flex [&>div]:flex-wrap [&>div]:gap-2"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
