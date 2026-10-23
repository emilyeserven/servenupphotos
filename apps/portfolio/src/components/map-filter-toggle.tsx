import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { FilterCount } from "@/components/photo-filters";
import { cn } from "@/lib/utils";

/**
 * The map's filters, behind a **Filters** button on phones so they don't cover the map, and always
 * shown on wider screens. The button says how many filters are set while they're hidden.
 */
export function MapFilterToggle({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:hidden dark:border-input"
      >
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        Filters
        <FilterCount count={open ? 0 : count} />
      </button>
      {/* Its children sit in the map's row of controls, as if there were no wrapper. */}
      <div id={listId} className={cn(open ? "contents" : "hidden md:contents")}>
        {children}
      </div>
    </>
  );
}
