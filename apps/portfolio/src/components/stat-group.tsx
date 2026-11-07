import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GridRow, NarrowRow } from "@/components/stat-row";
import type { StatGroup, StatRow } from "@/lib/stat-groups";

/** How many rows a group shows before its "Show all" button. */
const SHOWN_ROWS = 8;

/** A row chosen in a group that narrows another, and which group it narrows. */
export interface StatFocus {
  /** The narrowed group's title, such as "Cities", for its X's label. */
  title: string;
  /** The narrowed group's ID. */
  target: string;
  row: StatRow;
}

/** A row narrowing a group, with the filter for its photos and those of the rows narrowing it. */
export type FocusChain = (StatFocus & { filter: Record<string, string | string[]> })[];

/**
 * One group on the Stats page, such as Cameras, as a card of its rows. A group that narrows
 * another (`onNarrow`), such as Countries, narrows it with a click on a row, `chosen` being the row
 * chosen; any other group's rows open their photos on the Grid. A group narrowed by others says
 * by what (`focuses`, from the top down), each opening those photos on the Grid, or clearing it.
 * `title` takes the place of the group's title, such as a dropdown of its variants. A long group
 * shows its first rows and a button for the rest.
 */
export function StatGroupCard({
  group,
  title,
  focuses,
  chosen,
  onNarrow,
  onClearFocus,
}: {
  group: StatGroup;
  title?: ReactNode;
  focuses: FocusChain;
  chosen?: string;
  onNarrow?: (row: StatRow) => void;
  onClearFocus: (target: string) => void;
}) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...group.rows.map((row) => row.count));
  const rows = all ? group.rows : group.rows.slice(0, SHOWN_ROWS);
  return (
    <section
      aria-label={group.title}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <h3 className="font-semibold tracking-tight">{title ?? group.title}</h3>
      <FocusChips focuses={focuses} onClearFocus={onClearFocus} />
      {group.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">None of these photos say.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label}>
            <CardRow
              row={row}
              max={max}
              chosen={chosen}
              onNarrow={onNarrow}
              hideHint={focuses.length > 0}
            />
          </li>
        ))}
      </ul>
      <GroupFooter group={group} all={all} onShowAll={() => setAll(true)} />
    </section>
  );
}

/** The chips for the rows narrowing a group, from the top down; nothing when none do. */
function FocusChips({
  focuses,
  onClearFocus,
}: {
  focuses: FocusChain;
  onClearFocus: (target: string) => void;
}) {
  if (focuses.length === 0) return undefined;
  return (
    <div className="-mt-1 flex flex-wrap gap-1">
      {focuses.map((focus) => (
        <FocusChip key={focus.target} focus={focus} onClear={() => onClearFocus(focus.target)} />
      ))}
    </div>
  );
}

/** A row of a card: a toggle that narrows another group, or a link to its photos on the Grid. */
function CardRow({
  row,
  max,
  chosen,
  onNarrow,
  hideHint,
}: {
  row: StatRow;
  max: number;
  chosen?: string;
  onNarrow?: (row: StatRow) => void;
  hideHint: boolean;
}) {
  if (!onNarrow) return <GridRow row={row} max={max} hideHint={hideHint} />;
  return (
    <NarrowRow row={row} max={max} chosen={chosen === row.label} onClick={() => onNarrow(row)} />
  );
}

/**
 * What a narrowed group is narrowed to, such as Japan: a link to those photos on the Grid, and an
 * X that shows every photo again.
 */
function FocusChip({ focus, onClear }: { focus: FocusChain[number]; onClear: () => void }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link
        to="/grid"
        search={focus.filter}
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
