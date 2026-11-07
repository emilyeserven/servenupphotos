import { useState } from "react";
import type { TransitLine } from "@/api/transit";
import type { TripTransitLine } from "@/api/trip-lines";
import { cn } from "@/lib/utils";

/** The kinds of line the list filters by, each with the OpenStreetMap route kinds it covers. */
const KINDS: { label: string; routes: string[] }[] = [
  { label: "Bus", routes: ["bus", "trolleybus", "coach"] },
  { label: "Subway", routes: ["subway", "light_rail", "monorail", "tram"] },
  { label: "Train", routes: ["train"] },
];

/** The filter a line falls under, or "Other" (such as a ferry). */
function kindOf(line: TransitLine): string {
  return KINDS.find((k) => k.routes.includes(line.kind))?.label ?? "Other";
}

/** The filters worth offering for the lines: All, then each kind they have. */
function filtersFor(lines: TransitLine[]): string[] {
  const have = new Set(lines.map(kindOf));
  return ["All", ...[...KINDS.map((k) => k.label), "Other"].filter((k) => have.has(k))];
}

/** The line ridden, in its color, or that none is picked. */
export function LineBadge({ line }: { line?: TripTransitLine }) {
  if (!line) return <span className="text-muted-foreground italic">no line picked</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="size-3 rounded-full" style={{ background: line.colour || "#9333ea" }} />
      {line.ref ? `${line.ref} · ${line.name}` : line.name}
    </span>
  );
}

interface LineChoicesProps {
  lines?: TransitLine[];
  disabled: boolean;
  onPick: (line: TransitLine) => void;
}

/**
 * The lines found near both photos, each a button that picks it, with buttons that show only
 * buses, subways or trains when more than one kind was found.
 */
export function LineChoices({ lines = [], disabled, onPick }: LineChoicesProps) {
  const [filter, setFilter] = useState("All");
  const shown = lines.filter((l) => filter === "All" || kindOf(l) === filter);
  return (
    <div className="flex flex-col gap-1">
      <KindFilter filters={filtersFor(lines)} filter={filter} onFilter={setFilter} />
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {shown.map((line) => (
          <li key={line.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(line)}
              className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm disabled:opacity-50"
            >
              <LineBadge line={line} />
              <span className="text-muted-foreground">{lineEnds(line)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface KindFilterProps {
  filters: string[];
  filter: string;
  onFilter: (filter: string) => void;
}

/** The kind buttons, shown only when the lines found are of more than one kind. */
function KindFilter({ filters, filter, onFilter }: KindFilterProps) {
  if (filters.length <= 2) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Show lines">
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => onFilter(f)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs",
            filter === f && "bg-muted font-medium",
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/** Where the line runs, such as "Nakamozu → Esaka", or its kind when that isn't mapped. */
function lineEnds({ from, to, kind }: TransitLine): string {
  return from && to ? `${from} → ${to}` : kind;
}
