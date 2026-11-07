import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StatRow } from "@/lib/stat-groups";
import { cn } from "@/lib/utils";

const ROW =
  "group block w-full min-w-0 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A row that opens its photos on the Grid: its label over a bar as long as its share of the
 * group's biggest, and its count, which reads "See More (37) →" on hover without moving. A row's
 * hint, such as a city's country, shows as a tooltip, unless `hideHint`, as when the card already
 * says it.
 */
export function GridRow({ row, max, hideHint }: { row: StatRow; max: number; hideHint: boolean }) {
  if (!row.filter)
    return (
      <div className="px-2 py-1.5">
        <RowBody row={row} max={max} count={<span>{row.count}</span>} />
      </div>
    );
  return (
    <WithHint hint={hideHint ? undefined : row.hint}>
      <Link
        to="/grid"
        search={row.filter}
        className={ROW}
        aria-label={`${row.label}: see its ${row.count} photos on the Grid`}
      >
        <RowBody row={row} max={max} count={<SeeMore count={row.count} />} />
      </Link>
    </WithHint>
  );
}

/**
 * A row's count, with "See More (" before it and ") →" after it shown on hover. The text after
 * is only made visible, keeping its space, and the text before grows leftwards, so the number
 * doesn't move.
 */
export function SeeMore({ count }: { count: number }) {
  const shown = "group-hover:visible group-focus-visible:visible";
  return (
    <span className="flex items-center">
      <span
        className={cn(
          "invisible absolute right-full whitespace-nowrap bg-accent pr-px pl-1",
          shown,
        )}
      >
        See More (
      </span>
      {count}
      <span className={cn("invisible flex items-center pl-px", shown)} aria-hidden>
        )<ArrowRight className="ml-1 size-3" />
      </span>
    </span>
  );
}

/**
 * A row that narrows another group to its photos, such as a country narrowing the cities, or
 * widens it again once it has; highlighted while it's chosen.
 */
export function NarrowRow({
  row,
  max,
  chosen,
  onClick,
}: {
  row: StatRow;
  max: number;
  chosen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onClick}
      className={cn(ROW, chosen && "bg-accent")}
    >
      <RowBody row={row} max={max} count={<span>{row.count}</span>} />
    </button>
  );
}

/** The row with its hint as a tooltip on hover and focus, or just the row without one. */
function WithHint({ hint, children }: { hint?: string; children: ReactNode }) {
  if (!hint) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** A row's text, bar and count. */
function RowBody({ row, max, count }: { row: StatRow; max: number; count: ReactNode }) {
  return (
    <>
      <span className="flex items-baseline gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{row.label}</span>
        {row.detail && (
          <span className="min-w-0 shrink-[4] truncate text-xs text-muted-foreground">
            {row.detail}
          </span>
        )}
        <span className="relative ml-auto shrink-0 tabular-nums text-muted-foreground group-hover:text-foreground">
          {count}
        </span>
      </span>
      <span className="mt-1 block h-1.5 rounded-full bg-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-primary/70"
          style={{ width: `${(row.count / max) * 100}%` }}
        />
      </span>
    </>
  );
}
