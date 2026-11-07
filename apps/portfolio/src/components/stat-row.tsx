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
 * group's biggest, and its count, which "Grid" and an arrow take the place of on hover. A row's hint, such as
 * a city's country, shows as a tooltip.
 */
export function GridRow({ row, max }: { row: StatRow; max: number }) {
  if (!row.filter)
    return (
      <div className="px-2 py-1.5">
        <RowBody row={row} max={max} />
      </div>
    );
  return (
    <WithHint hint={row.hint}>
      <Link
        to="/grid"
        search={row.filter}
        className={ROW}
        aria-label={`${row.label}: see its ${row.count} photos on the Grid`}
      >
        <RowBody row={row} max={max} trailing={<GridHint />} />
      </Link>
    </WithHint>
  );
}

/** What a row that opens the Grid adds on hover. */
function GridHint() {
  return (
    <span className="flex shrink-0 items-center gap-0.5 self-center text-xs font-medium text-foreground">
      Grid
      <ArrowRight className="size-3" aria-hidden />
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
      <RowBody row={row} max={max} />
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

/** A row's text, bar and count, which `trailing` takes the place of on hover. */
function RowBody({ row, max, trailing }: { row: StatRow; max: number; trailing?: ReactNode }) {
  const hides = trailing ? "group-hover:hidden group-focus-visible:hidden" : "";
  return (
    <>
      <span className="flex items-baseline gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{row.label}</span>
        {row.detail && (
          <span className="min-w-0 shrink-[4] truncate text-xs text-muted-foreground">
            {row.detail}
          </span>
        )}
        <span className={cn("ml-auto shrink-0 tabular-nums text-muted-foreground", hides)}>
          {row.count}
        </span>
        {trailing && (
          <span className="ml-auto hidden group-hover:flex group-focus-visible:flex">
            {trailing}
          </span>
        )}
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
