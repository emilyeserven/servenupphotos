import { Link } from "@tanstack/react-router";
import { Grid3x3, X } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StatRow } from "@/lib/stat-groups";
import { parseFilters } from "@/lib/photo-filters";
import { cn } from "@/lib/utils";

/** The Stats page's filters as its URL has them: the shared ones and the camera ones. */
export type StatFilters = Record<string, unknown>;

/** Whether the row's filter is already set, so its photos are the ones counted. */
function isChosen(row: StatRow, filters: StatFilters): boolean {
  const entries = Object.entries(row.filter ?? {});
  return entries.length > 0 && entries.every(([key, value]) => filters[key] === value);
}

/** The Stats page's search with the row's filter set, or cleared when it's already set. */
function toggled(row: StatRow, chosen: boolean) {
  return (prev: Record<string, unknown>) => {
    const keys = Object.keys(row.filter ?? {});
    if (chosen) return { ...prev, ...Object.fromEntries(keys.map((key) => [key, undefined])) };
    return { ...prev, ...row.filter };
  };
}

const ROW_LINK =
  "group block min-w-0 flex-1 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A row: its label over a bar as long as its share of the group's biggest, and its count. A row
 * with a filter narrows the Stats page to its photos, or clears that again once chosen, and has a
 * button to see them on the Grid with the page's other filters; a year opens the Timeline
 * narrowed to it. A row's hint, such as a city's country, shows on hover.
 */
export function StatRowItem({
  row,
  max,
  filters,
}: {
  row: StatRow;
  max: number;
  filters: StatFilters;
}) {
  const chosen = isChosen(row, filters);
  const body = <RowBody row={row} max={max} chosen={chosen} />;
  return (
    <div className="flex items-center gap-1">
      <WithHint hint={row.hint}>{rowLink(row, filters, chosen, body)}</WithHint>
      {row.filter && (
        <Link
          to="/grid"
          search={{ ...filters, ...row.filter }}
          aria-label={`See the ${row.label} photos on the Grid`}
          title="See them on the Grid"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Grid3x3 className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** The row's main link: narrowing the Stats page, or for a year the Timeline; plain text without either. */
function rowLink(row: StatRow, filters: StatFilters, chosen: boolean, body: ReactNode) {
  if (row.filter) return filterLink(row, chosen, body);
  if (row.timeline) return timelineLink(row, filters, body);
  return <div className="min-w-0 flex-1 px-2 py-1.5">{body}</div>;
}

/** A link that narrows the Stats page to the row's photos, or widens it again once it has. */
function filterLink(row: StatRow, chosen: boolean, body: ReactNode) {
  return (
    <Link
      to="/stats"
      search={toggled(row, chosen)}
      resetScroll={false}
      aria-current={chosen ? "true" : undefined}
      className={cn(ROW_LINK, chosen && "bg-accent")}
    >
      {body}
    </Link>
  );
}

/** A link to the Timeline narrowed to the row's year, keeping the filters it shares. */
function timelineLink(row: StatRow, filters: StatFilters, body: ReactNode) {
  return (
    <Link
      to="/timeline"
      search={{ ...parseFilters(filters), ...row.timeline }}
      className={ROW_LINK}
    >
      {body}
    </Link>
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

/** A row's text, bar and count, with an X while it's chosen. */
function RowBody({ row, max, chosen }: { row: StatRow; max: number; chosen: boolean }) {
  return (
    <>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{row.label}</span>
        {row.detail && (
          <span className="min-w-0 shrink-[4] truncate text-xs text-muted-foreground">
            {row.detail}
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{row.count}</span>
        {chosen && <X className="size-3.5 shrink-0 self-center" aria-label="Clear" />}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${(row.count / max) * 100}%` }}
        />
      </div>
    </>
  );
}
