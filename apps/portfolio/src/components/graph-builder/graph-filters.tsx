import { ChevronsUpDown, ListFilter, Plus, X } from "lucide-react";
import { ChoiceRow } from "@/components/choice-row";
import { ClearFilterButton } from "@/components/clear-filter-button";
import { StatSelect } from "@/components/graph-builder/graph-field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  onChange,
}: {
  filters: GraphFilter[];
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
      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden />
          Add a filter
        </Button>
      </div>
    </div>
  );
}

/** The first stat no filter uses yet, for a new filter; the first stat when they all are. */
function unusedStat(filters: GraphFilter[]): string {
  const used = new Set(filters.map((f) => f.stat));
  return (GRAPH_STATS.find((stat) => !used.has(stat.id)) ?? GRAPH_STATS[0]!).id;
}

/** One filter: its stat, a button opening the stat's values to pick from, and an X to take it away. */
function FilterRow({
  filter,
  onChange,
  onRemove,
}: {
  filter: GraphFilter;
  onChange: (filter: GraphFilter) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatSelect
        label="Filter by"
        value={filter.stat}
        onChange={(stat) => onChange({ stat, values: [] })}
      />
      <ValuePicker filter={filter} onChange={(values) => onChange({ ...filter, values })} />
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
  );
}

/** The values with the label added, or taken out when it's in them. */
function toggled(values: string[], label: string): string[] {
  return values.includes(label) ? values.filter((v) => v !== label) : [...values, label];
}

/** What a filter's button says: "Any", the one value picked, or how many are. */
function pickedText(values: string[]): string {
  if (values.length === 0) return "Any";
  return values.length === 1 ? values[0]! : `${values.length} picked`;
}

/**
 * A filter's values, like the Grid's **Places** filter: a button saying which are picked, with an X
 * to clear them, that opens every value of the stat with how many photos have it, any number of
 * which can be picked.
 */
function ValuePicker({
  filter,
  onChange,
}: {
  filter: GraphFilter;
  onChange: (values: string[]) => void;
}) {
  const stat = statById(filter.stat);
  const text = pickedText(filter.values);
  const picked = filter.values.length > 0;
  return (
    <Popover>
      {/* The X sits over the button, inside its border, as a button can't hold another. */}
      <div className="relative inline-flex max-w-56 items-center">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-label={`${stat.label}: ${text}`}
            className={cn("w-full font-normal has-[>svg]:pr-8", picked && "has-[>svg]:pr-14")}
          >
            <ListFilter aria-hidden className="text-muted-foreground" />
            <span className="truncate">{text}</span>
          </Button>
        </PopoverTrigger>
        {picked && (
          <ClearFilterButton
            label={stat.label}
            onClear={() => onChange([])}
            className="absolute right-7"
          />
        )}
        <ChevronsUpDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 size-4 opacity-50"
        />
      </div>
      <PopoverContent
        align="start"
        className="flex max-h-80 w-[min(18rem,calc(100vw-2rem))] flex-col overflow-y-auto p-1"
      >
        {stat.build(photos).rows.map((row) => (
          <ChoiceRow
            key={row.label}
            label={row.label}
            count={row.count}
            on={filter.values.includes(row.label)}
            onClick={() => onChange(toggled(filter.values, row.label))}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
