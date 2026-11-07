import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ORDER_TITLES } from "@/components/color-order-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ColorOrder } from "@/lib/color-sort";
import { defaultOrder, type GridSort } from "@/lib/grid-sort";
import { cn } from "@/lib/utils";

/** What the **Sort** menu sorts by; newest and oldest first are both "taken", either way round. */
type Criterion = "taken" | "added" | "time" | "color" | "vivid";

/** Each criterion's name in the menu and on the button, in the menu's order. */
const CRITERIA: readonly (readonly [Criterion, string])[] = [
  ["taken", "Date taken"],
  ["added", "Date added"],
  ["time", "Time of day"],
  ["color", "Color"],
  ["vivid", "Vividness"],
];

/** What each way round means for the sorts that aren't by color, for the arrow's tooltip. */
const DATE_ORDER_TITLES: Record<"taken" | "added" | "time", Record<ColorOrder, string>> = {
  taken: { asc: "Oldest first", desc: "Newest first" },
  added: { asc: "Least recently added first", desc: "Most recently added first" },
  time: { asc: "Earliest in the day first", desc: "Latest in the day first" },
};

/** Every criterion's ascending and descending meaning. */
const ORDER_MEANINGS: Record<Criterion, Record<ColorOrder, string>> = {
  ...DATE_ORDER_TITLES,
  ...ORDER_TITLES,
};

/** The criterion a sort is by. */
function criterionOf(sort: GridSort): Criterion {
  return sort === "newest" || sort === "oldest" ? "taken" : sort;
}

/** The name of the criterion a sort is by. */
function criterionLabel(sort: GridSort): string {
  const criterion = criterionOf(sort);
  return CRITERIA.find(([key]) => key === criterion)?.[1] ?? "";
}

/**
 * The URL change for sorting by a criterion its default way round, which also clears the color
 * sorts' secondary sort; undefined clears the sort back to the Grid's default, newest first.
 */
function pickSearch(criterion: Criterion | undefined) {
  const sort = criterion === "taken" ? "newest" : criterion;
  return { sort, order: undefined, secondary: undefined, secondaryOrder: undefined };
}

/**
 * The URL change for turning the sort the other way round: newest and oldest first swap, and the
 * others keep `?order=` only when it's not their default.
 */
function flipSearch(sort: GridSort, order: ColorOrder) {
  const next: ColorOrder = order === "asc" ? "desc" : "asc";
  if (criterionOf(sort) === "taken") return { sort: TAKEN_SORTS[next], order: undefined };
  return { order: next === defaultOrder(sort) ? undefined : next };
}

/** Sorting by when photos were taken, each way round. */
const TAKEN_SORTS: Record<ColorOrder, GridSort> = { asc: "oldest", desc: "newest" };

/**
 * The Grid's **Sort** button. Until a sort is picked it says just "Sort", and the photos are newest
 * first. Once one is picked from its menu it shows an arrow for which way round it runs, which
 * turns it around when clicked, and the sort's name, which opens the menu again. Kept in the URL
 * (`?sort=` and `?order=`), so a link keeps it.
 */
export function GridSortControl({ sort, order }: { sort?: GridSort; order: ColorOrder }) {
  const navigate = useNavigate({ from: "/grid" });
  const [open, setOpen] = useState(false);
  const go = (change: Record<string, unknown>) =>
    void navigate({ search: (prev) => ({ ...prev, ...change }), replace: true });
  const pick = (criterion: Criterion | undefined) => {
    setOpen(false);
    go(pickSearch(criterion));
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex h-8 items-stretch rounded-md border bg-background text-sm font-medium shadow-xs dark:border-input dark:bg-input/30">
        {sort && (
          <OrderArrow sort={sort} order={order} onClick={() => go(flipSearch(sort, order))} />
        )}
        <PopoverTrigger asChild>
          <button type="button" className={cn(PART_CLASS, "gap-1.5 px-2.5")}>
            <TriggerLabel sort={sort} />
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="flex w-48 flex-col gap-0.5 p-1 text-sm">
        <SortMenu current={sort && criterionOf(sort)} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}

/** How each half of the button looks. */
const PART_CLASS =
  "inline-flex items-center rounded-[calc(var(--radius-md)-1px)] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** The menu button's words: "Sort" before one is picked, or the sort's name after. */
function TriggerLabel({ sort }: { sort?: GridSort }) {
  if (!sort) {
    return (
      <>
        <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden />
        Sort
      </>
    );
  }
  return (
    <>
      <span className="sr-only">Sort by</span>
      {criterionLabel(sort)}
    </>
  );
}

/** The arrow for which way round the sort runs, up for ascending, that turns it around. */
function OrderArrow({
  sort,
  order,
  onClick,
}: {
  sort: GridSort;
  order: ColorOrder;
  onClick: () => void;
}) {
  const Icon = order === "asc" ? ArrowUp : ArrowDown;
  const meaning = ORDER_MEANINGS[criterionOf(sort)][order];
  return (
    <button
      type="button"
      title={`${meaning}. Click to turn it around.`}
      aria-label={`${meaning}. Turn the sort around`}
      onClick={onClick}
      className={cn(PART_CLASS, "border-r px-2 dark:border-input")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

/** The menu's criteria, the current one ticked, then **Clear sort** once one is picked. */
function SortMenu({
  current,
  onPick,
}: {
  current?: Criterion;
  onPick: (criterion: Criterion | undefined) => void;
}) {
  return (
    <>
      {CRITERIA.map(([criterion, label]) => (
        <MenuItem key={criterion} checked={criterion === current} onClick={() => onPick(criterion)}>
          {label}
        </MenuItem>
      ))}
      {current && (
        <>
          <div className="my-1 border-t" role="separator" />
          <MenuItem checked={false} onClick={() => onPick(undefined)}>
            Clear sort
          </MenuItem>
        </>
      )}
    </>
  );
}

/** One of the menu's rows, with a tick when it's the current sort. */
function MenuItem({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
    >
      <Check className={cn("size-4", !checked && "invisible")} aria-hidden />
      {children}
    </button>
  );
}
