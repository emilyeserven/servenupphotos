import { ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { ClearableTrigger, TriggerArrows } from "@portfolio/components/clearable-trigger";
import { FilterCount } from "@portfolio/components/filter-count";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";

/**
 * A **More filters** button that opens the filters it holds in a popup, such as the map's **Groups**
 * and **When** pickers, with how many of them are set (`count`) after its label. The filters sit
 * side by side in a row, like the Grid's filters, wrapping onto more rows on phones. While any is
 * set, pointing at the button shows an X that clears them all (`onClear`), like each picker's.
 */
export function MoreFilters({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <ClearableTrigger label="all filters" count={count} onClear={onClear}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="font-normal">
            <ListFilter className="text-muted-foreground" aria-hidden />
            {/* Just the icon on phones, so the map's controls fit on one row. */}
            <span className="max-md:sr-only">More filters</span>
            <FilterCount count={count} />
            <TriggerArrows clearable={count > 0} className="max-md:hidden" />
          </Button>
        </PopoverTrigger>
      </ClearableTrigger>
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
