import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { GridRow, NarrowRow } from "@/components/stat-row";
import type { StatGroup, StatRow } from "@/lib/stat-groups";

/** A row chosen in a group that narrows another, and which group it narrows. */
export interface StatFocus {
  /** The narrowed group's title, such as "Cities", for its X's label. */
  title: string;
  /** The narrowed group's ID. */
  target: string;
  row: StatRow;
}

/**
 * A row narrowing a group, with the filter for its photos and those of the rows narrowing it, and
 * the word before it, such as "with" or "and"; "in" when left out.
 */
export type FocusChain = (StatFocus & {
  filter: Record<string, string | string[] | number[]>;
  prefix?: string;
})[];

/**
 * One group on the Stats page, such as Cameras, as a card of its rows. A group that narrows
 * another (`onNarrow`), such as Countries, narrows it with a click on a row, `chosen` being the row
 * chosen; any other group's rows open their photos on the Grid. A group narrowed by others says
 * by what (`focuses`), each opening those photos on the Grid, or clearing it.
 * `control` sits at the other end of the title's row, such as a Group by dropdown. Every row is
 * shown, a long group scrolling within the card's height.
 */
export function StatGroupCard({
  group,
  control,
  focuses,
  chosen,
  onNarrow,
  onClearFocus,
}: {
  group: StatGroup;
  control?: ReactNode;
  focuses: FocusChain;
  chosen?: string;
  onNarrow?: (row: StatRow) => void;
  onClearFocus: (target: string) => void;
}) {
  const max = Math.max(1, ...group.rows.map((row) => row.count));
  return (
    <section
      aria-label={group.title}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold tracking-tight">{group.title}</h3>
        {control}
      </div>
      <FocusChips focuses={focuses} onClearFocus={onClearFocus} />
      {group.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">None of these photos say.</p>
      )}
      <ul className="-mr-2 flex max-h-96 flex-col gap-1 overflow-y-auto pr-2">
        {group.rows.map((row) => (
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
      <GroupFooter group={group} />
    </section>
  );
}

/**
 * What a group is narrowed to, such as "in Japan" from the card right above it, or every linked
 * card's choice; nothing when it isn't narrowed.
 */
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
 * What a narrowed group is narrowed to, as quiet text such as "in Japan": the name links to those
 * photos on the Grid, and an X after it shows every photo again.
 */
function FocusChip({ focus, onClear }: { focus: FocusChain[number]; onClear: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
      <span className="truncate">
        {focus.prefix ?? "in"}{" "}
        <Link
          to="/grid"
          search={focus.filter}
          className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {focus.row.label}
          <span className="sr-only">: see its {focus.row.count} photos on the Grid</span>
        </Link>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Show every ${focus.title.toLowerCase()} again`}
        className="shrink-0 rounded-full p-1 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** How many photos a group couldn't count; nothing when it counted them all. */
function GroupFooter({ group }: { group: StatGroup }) {
  if (group.missing === 0) return undefined;
  return <p className="text-right text-xs text-muted-foreground">{missingText(group)}</p>;
}

/** What a group says about the photos it couldn't count, such as "3 photos don't say". */
function missingText({ missing, missingReason }: StatGroup): string {
  const photos = missing === 1 ? "1 photo" : `${missing} photos`;
  if (missingReason === "uncategorized") return `${photos} in none of these`;
  return `${photos} ${missing === 1 ? "doesn't" : "don't"} say`;
}
