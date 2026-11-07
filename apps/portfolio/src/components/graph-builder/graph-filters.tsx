import { Plus, X } from "lucide-react";
import { StatSelect } from "@/components/graph-builder/graph-field";
import { Button } from "@/components/ui/button";
import { GRAPH_STATS, type GraphFilter, statById } from "@/lib/graph-data";
import { photos } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * The graph's filters, each a stat and the values it keeps, such as Countries: Japan or Korea. A
 * photo is kept when it has any of a filter's values, and is in every filter. A filter with no
 * values picked keeps every photo.
 */
export function GraphFilters({
  filters,
  kept,
  onChange,
}: {
  filters: GraphFilter[];
  /** How many photos the filters keep. */
  kept: number;
  onChange: (filters: GraphFilter[]) => void;
}) {
  const update = (index: number, filter: GraphFilter) =>
    onChange(filters.map((f, i) => (i === index ? filter : f)));
  const add = () => onChange([...filters, { stat: unusedStat(filters), values: [] }]);
  return (
    <div className="flex flex-col gap-2">
      {filters.map((filter, index) => (
        <FilterRow
          key={index}
          filter={filter}
          onChange={(next) => update(index, next)}
          onRemove={() => onChange(filters.filter((_, i) => i !== index))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden />
          Add a filter
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {kept.toLocaleString()} of {photos.length.toLocaleString()} photos
        </span>
      </div>
    </div>
  );
}

/** The first stat no filter uses yet, for a new filter; the first stat when they all are. */
function unusedStat(filters: GraphFilter[]): string {
  const used = new Set(filters.map((f) => f.stat));
  return (GRAPH_STATS.find((stat) => !used.has(stat.id)) ?? GRAPH_STATS[0]!).id;
}

/** One filter: its stat, a button for each of the stat's values, and an X to take it away. */
function FilterRow({
  filter,
  onChange,
  onRemove,
}: {
  filter: GraphFilter;
  onChange: (filter: GraphFilter) => void;
  onRemove: () => void;
}) {
  const rows = statById(filter.stat).build(photos).rows;
  const toggle = (label: string) => onChange({ ...filter, values: toggled(filter.values, label) });
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2 sm:flex-row sm:items-start">
      <div className="flex items-center gap-1">
        <StatSelect
          label="Filter by"
          value={filter.stat}
          onChange={(stat) => onChange({ stat, values: [] })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove filter"
          onClick={onRemove}
          className="size-8"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
        {rows.map((row) => (
          <ValueChip
            key={row.label}
            label={row.label}
            count={row.count}
            on={filter.values.includes(row.label)}
            onClick={() => toggle(row.label)}
          />
        ))}
      </div>
    </div>
  );
}

/** The values with the label added, or taken out when it's in them. */
function toggled(values: string[], label: string): string[] {
  return values.includes(label) ? values.filter((v) => v !== label) : [...values, label];
}

/** A value a filter can keep, with how many photos have it; filled in while it's kept. */
function ValueChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
