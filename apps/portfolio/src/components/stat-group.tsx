import { useState } from "react";
import { type StatFilters, StatRowItem } from "@/components/stat-row";
import type { StatGroup } from "@/lib/stat-groups";

/** How many rows a group shows before its "Show all" button. */
const SHOWN_ROWS = 8;

/**
 * One group on the Stats page, such as Cameras, as a card of its rows (see `StatRowItem`). A long
 * group shows its first rows and a button for the rest.
 */
export function StatGroupCard({ group, filters }: { group: StatGroup; filters: StatFilters }) {
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
        <p className="text-sm text-muted-foreground">None of these photos say.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label}>
            <StatRowItem row={row} max={max} filters={filters} />
          </li>
        ))}
      </ul>
      <GroupFooter group={group} all={all} onShowAll={() => setAll(true)} />
    </section>
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
