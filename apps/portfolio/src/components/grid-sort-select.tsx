import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown } from "lucide-react";
import type { GridSort } from "@/lib/grid-sort";

const SORTS: { sort: GridSort; label: string }[] = [
  { sort: "newest", label: "Newest to Oldest" },
  { sort: "oldest", label: "Oldest to Newest" },
  { sort: "added", label: "Recently Added" },
  { sort: "time", label: "Time of Day" },
  { sort: "color", label: "Color" },
  { sort: "vivid", label: "Vividness" },
];

/** The sort a dropdown value names, newest first for anything else. */
function sortOf(value: string): GridSort {
  return SORTS.find((option) => option.sort === value)?.sort ?? "newest";
}

/**
 * A dropdown to sort the Grid by when each photo was taken or added, the time of day it was taken, or by color or vividness, kept in the
 * URL so a link keeps it. Newest to oldest is the default and is left out of the URL. Changing it
 * clears the color sorts' order and secondary sort.
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
          const next = sortOf(event.target.value);
          void navigate({
            search: (prev) => ({
              ...prev,
              sort: next === "newest" ? undefined : next,
              order: undefined,
              secondary: undefined,
              secondaryOrder: undefined,
            }),
            replace: true,
          });
        }}
        className="h-8 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30"
      >
        {SORTS.map((option) => (
          <option key={option.sort} value={option.sort}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
