import {
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  type Header,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Urgency } from "@/lib/needs-attention";
import { cn } from "@/lib/utils";

/** One row of the Needs attention table: a problem, how urgent it is, how many photos, and where to fix it. */
export interface AttentionRow {
  /** A key for the row, such as the problem's name. */
  id: string;
  urgency: Urgency;
  /** What the row says, as shown. */
  label: ReactNode;
  /** What the row says as plain text, which the Problem column sorts by. */
  labelText: string;
  /** How many photos, which the Photos column sorts by. */
  count: number;
  /** How many photos as shown, such as "3 photos to schedule". */
  countText: string;
  /** A link to the page that fixes it. */
  fix: ReactNode;
}

/** Each urgency's place when sorting, high first, and its dot's color and name. */
const URGENCIES: Record<Urgency, { rank: number; dot: string; name: string }> = {
  high: { rank: 0, dot: "bg-red-500", name: "High" },
  medium: { rank: 1, dot: "bg-yellow-400", name: "Medium" },
  low: { rank: 2, dot: "bg-gray-400 dark:bg-gray-500", name: "Low" },
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
});

const helper = createColumnHelper<typeof features, AttentionRow>();

const COLUMNS = helper.columns([
  helper.accessor((row) => URGENCIES[row.urgency].rank, {
    id: "priority",
    header: "Priority",
    sortFn: "basic",
    cell: ({ row }) => <UrgencyDot urgency={row.original.urgency} />,
  }),
  helper.accessor("labelText", {
    id: "problem",
    header: "Problem",
    sortFn: "text",
    cell: ({ row }) => <ProblemCell row={row.original} />,
  }),
  helper.accessor("count", {
    id: "photos",
    header: "Photos",
    sortFn: "basic",
    cell: ({ row }) => row.original.countText,
  }),
  helper.display({ id: "fix", header: "Fix", cell: ({ row }) => row.original.fix }),
]);

/** Each column's cell styles: the priority dot centered, the counts muted, and Fix only on wider screens. */
const CELL_CLASSES: Record<string, string> = {
  priority: "w-px text-center",
  problem: "font-medium",
  photos: "text-muted-foreground tabular-nums sm:whitespace-nowrap",
  fix: "hidden whitespace-nowrap sm:table-cell",
};

/** The problems as a table sortable by priority, problem or photo count, most urgent first to start. */
export function NeedsAttentionTable({ rows }: { rows: AttentionRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "priority", desc: false }]);
  const table = useTable({
    features,
    columns: COLUMNS,
    data: rows,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y border-t">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className={cn("px-3 py-2.5", CELL_CLASSES[cell.column.id])}>
                  <FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What the row says, with its fix link under it on narrow screens, where the Fix column is hidden. */
function ProblemCell({ row }: { row: AttentionRow }) {
  return (
    <>
      {row.label}
      <div className="mt-1 font-normal sm:hidden">{row.fix}</div>
    </>
  );
}

/** A dot in the urgency's color, red, yellow or gray, named for screen readers and on hover. */
function UrgencyDot({ urgency }: { urgency: Urgency }) {
  const { dot, name } = URGENCIES[urgency];
  return (
    <span className="inline-flex items-center justify-center" title={`${name} priority`}>
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      <span className="sr-only">{name}</span>
    </span>
  );
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

type AttentionHeader = Header<typeof features, AttentionRow, unknown>;

/** A column's name, a button sorting by it when it can be sorted. */
function HeaderCell({ header }: { header: AttentionHeader }) {
  const sorted = header.column.getIsSorted();
  return (
    <th
      scope="col"
      aria-sort={sorted ? ARIA_SORT[sorted] : undefined}
      className={cn("px-3 py-2 font-medium whitespace-nowrap", CELL_CLASSES[header.column.id])}
    >
      {header.column.getCanSort() ? <SortButton header={header} /> : <FlexRender header={header} />}
    </th>
  );
}

function SortButton({ header }: { header: AttentionHeader }) {
  const sorted = header.column.getIsSorted();
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 [&_svg]:size-3.5",
        sorted && "text-foreground",
      )}
    >
      <FlexRender header={header} />
      <SortIcon sorted={sorted} />
    </button>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUpIcon aria-hidden />;
  if (sorted === "desc") return <ArrowDownIcon aria-hidden />;
  return <ArrowUpDownIcon aria-hidden className="opacity-50" />;
}
