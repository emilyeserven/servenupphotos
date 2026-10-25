import { ChevronsUpDown, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
          More filters
          {badge}
          <ChevronsUpDown className="opacity-50" aria-hidden />
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
