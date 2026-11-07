import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { StatGroup, StatRow } from "@/lib/stats";

/** How many rows a group shows before its "Show all" button. */
const SHOWN_ROWS = 8;

/**
 * One group on the Stats page, such as Cameras, as a card: each value with a bar as long as its
 * share of the group's biggest, and its photo count. A row links to the photos it counts when a
 * view filters by it. A long group shows its first rows and a button for the rest.
 */
export function StatGroupCard({ group }: { group: StatGroup }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...group.rows.map((row) => row.count));
  const rows = all ? group.rows : group.rows.slice(0, SHOWN_ROWS);
  return (
    <section
      aria-label={group.title}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <h3 className="font-semibold tracking-tight">{group.title}</h3>
      {group.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos say yet.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label}>
            <StatRowItem row={row} max={max} />
          </li>
        ))}
      </ul>
      <GroupFooter group={group} all={all} onShowAll={() => setAll(true)} />
    </section>
  );
}

/** The button for a long group's hidden rows, and how many photos don't say. */
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
      {group.missing > 0 && <span className="ml-auto">{missingText(group.missing)}</span>}
    </div>
  );
}

/** What a group says about the photos it couldn't count, such as "3 photos don't say". */
function missingText(count: number): string {
  return count === 1 ? "1 photo doesn't say" : `${count} photos don't say`;
}

/** A row: its label and detail over a bar, and its count, linked when it has a link. */
function StatRowItem({ row, max }: { row: StatRow; max: number }) {
  const body = <RowBody row={row} max={max} linked={row.link !== undefined} />;
  if (!row.link) return <div className="px-2 py-1.5">{body}</div>;
  return (
    <Link
      to={row.link.to}
      search={row.link.search}
      className="group block rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {body}
    </Link>
  );
}

/** A row's text, bar and count. */
function RowBody({ row, max, linked }: { row: StatRow; max: number; linked: boolean }) {
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
        {linked && (
          <ChevronRight
            className="size-3.5 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        )}
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
