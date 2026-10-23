import { cn } from "@/lib/utils";

/** The outline around a row of buttons that switch between views, such as the Grid's tile shape. */
export const CONTROL_FRAME =
  "inline-flex rounded-md border bg-background p-0.5 shadow-xs dark:border-input dark:bg-input/30";

/** How one of those buttons looks, depending on whether it's on. */
export function controlButtonClass(active: boolean): string {
  return cn(
    "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
  );
}
