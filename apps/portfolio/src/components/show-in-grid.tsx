import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

/**
 * A Numbers group's Show in Grid button, opening the Grid with every value chosen on its cards as
 * filters; nothing while none is chosen.
 */
export function ShowInGrid({ filter }: { filter: Record<string, unknown> | undefined }) {
  if (!filter || Object.keys(filter).length === 0) return undefined;
  return (
    <Link
      to="/grid"
      search={filter}
      className="flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <LayoutGrid className="size-3.5 text-muted-foreground" aria-hidden />
      Show in Grid
    </Link>
  );
}
