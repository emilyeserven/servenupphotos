import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown } from "lucide-react";

/** Which end of the Grid comes first: the newest photo taken, or the oldest. */
export type GridSort = "newest" | "oldest";

/**
 * A dropdown to sort the Grid by when each photo was taken, kept in the URL so a link keeps it.
 * Newest to oldest is the default and is left out of the URL.
 */
export function GridSortSelect({ sort }: { sort: GridSort }) {
  const navigate = useNavigate({ from: "/grid" });
  return (
    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <ArrowUpDown className="size-4" aria-hidden />
      <span className="sr-only">Sort</span>
      <select
        value={sort}
        onChange={(event) => {
          const next = event.target.value === "oldest" ? "oldest" : undefined;
          void navigate({ search: (prev) => ({ ...prev, sort: next }), replace: true });
        }}
        className="h-8 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30"
      >
        <option value="newest">Newest to Oldest</option>
        <option value="oldest">Oldest to Newest</option>
      </select>
    </label>
  );
}
