import { ChevronsUpDown, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";

/**
 * A **More filters** button that opens the filters it holds in a popup, such as the map's album,
 * tag and genre dropdowns, with `badge` after its label, such as how many of them are set.
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
        className="flex w-auto flex-col items-stretch gap-2 p-2 [&_select]:w-full [&>div]:flex"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
