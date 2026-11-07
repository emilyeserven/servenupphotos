import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { GridRow, NarrowRow } from "@/components/stat-row";
import type { StatGroup, StatRow } from "@/lib/stat-groups";

/** How many rows a group shows before its "Show all" button. */
const SHOWN_ROWS = 8;

/** A row chosen in a group that narrows another, and which group it's in. */
export interface StatFocus {
  title: string;
  row: StatRow;
}

/**
 * One group on the Stats page, such as Cameras, as a card of its rows. A group that narrows
 * another (`onNarrow`), such as Countries, narrows it with a click on a row, `chosen` being the row
 * chosen; any other group's rows open their photos on the Grid. A group narrowed by another says
 * by what (`focus`), which opens those photos on the Grid, or clears it. A long group shows its
 * first rows and a button for the rest.
 */
export function StatGroupCard({
  group,
  focus,
  chosen,
  onNarrow,
  onClearFocus,
}: {
  group: StatGroup;
  focus?: StatFocus;
  chosen?: string;
  onNarrow?: (row: StatRow) => void;
  onClearFocus: () => void;
}) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...group.rows.map((row) => row.count));
  const rows = all ? group.rows : group.rows.slice(0, SHOWN_ROWS);
  return (
    <section
      aria-label={group.title}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <h3 className="font-semibold tracking-tight">{group.title}</h3>
      {focus && <FocusChip focus={focus} onClear={onClearFocus} />}
      {group.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">None of these photos say.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label}>
            {onNarrow ? (
              <NarrowRow
                row={row}
                max={max}
                chosen={chosen === row.label}
                onClick={() => onNarrow(row)}
              />
            ) : (
              <GridRow row={row} max={max} />
            )}
          </li>
        ))}
      </ul>
      <GroupFooter group={group} all={all} onShowAll={() => setAll(true)} />
    </section>
  );
}

/**
 * What a narrowed group is narrowed to, such as Japan: a link to those photos on the Grid, and an
 * X that shows every photo again.
 */
function FocusChip({ focus, onClear }: { focus: StatFocus; onClear: () => void }) {
  return (
    <div className="-mt-1 flex items-center gap-1 text-sm">
      <Link
        to="/grid"
        search={focus.row.filter}
        className="group flex min-w-0 items-center gap-1.5 rounded-full border bg-accent px-2.5 py-0.5 font-medium outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="truncate">{focus.row.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{focus.row.count}</span>
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">: see them on the Grid</span>
      </Link>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Show every ${focus.title.toLowerCase()} again`}
        className="rounded-full p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** The button for a long group's hidden rows, and how many photos it couldn't count. */
function GroupFooter({
  group,
  all,
  onShowAll,
}: {
  group: StatGroup;
  all: boolean;
  onShowAll: () => void;
}) {
  const hidden = all ? 0 : group.rows.length - SHOWN_ROWS;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Show all {group.rows.length}
        </button>
      )}
      {group.missing > 0 && <span className="ml-auto">{missingText(group)}</span>}
    </div>
  );
}

/** What a group says about the photos it couldn't count, such as "3 photos don't say". */
function missingText({ missing, missingReason }: StatGroup): string {
  const photos = missing === 1 ? "1 photo" : `${missing} photos`;
  if (missingReason === "uncategorized") return `${photos} in none of these`;
  return `${photos} ${missing === 1 ? "doesn't" : "don't"} say`;
}
