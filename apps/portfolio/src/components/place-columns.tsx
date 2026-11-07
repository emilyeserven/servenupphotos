import { ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HiddenNote } from "@portfolio/components/hidden-note";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { Button } from "@portfolio/components/ui/button";
import { PopoverContent } from "@portfolio/components/ui/popover";
import type { LocationOption } from "@portfolio/lib/filter-options";
import {
  columnName,
  everyOption,
  type PlaceMatch,
  placeMatches,
  startColumns,
  valueOf,
  withPhotos,
} from "@portfolio/lib/place-tree";
import { cn } from "@portfolio/lib/utils";

/** What the Places flyout lists, and what choosing in it does. */
interface PanelProps {
  options: LocationOption[];
  /** The chosen places' values, for checkboxes; left out to pick one place, as on the Map. */
  selected?: string[];
  /** Gets the place's value, such as "city:Seoul": turned on or off, or picked on the Map. */
  onChoose: (value: string) => void;
  /** Unchooses every place, from **Clear**. */
  onClear?: () => void;
  /** Gets the value pointed at or focused, and undefined after; left out, nothing is told. */
  onHover?: (value: string | undefined) => void;
}

/**
 * The flyout of a Places button, like a Mac's Finder in columns: the countries first, and beside
 * them a column for what's in the one opened (its regions, cities or places), then what's in the
 * one opened there, and so on. With `selected`, each place has a checkbox, so any number can be
 * chosen across any countries. Without it, as on the Map, clicking a place with nothing in it, or
 * **All of** at the top of a column, picks that one. A search lists every match with what it's in.
 */
export function PlacesPanel(props: PanelProps) {
  const chosen = props.selected ?? [];
  const [query, setQuery] = useState("");
  const available = withPhotos(props.options, chosen);
  const hidden = everyOption(props.options).length - everyOption(available).length;
  return (
    <PopoverContent
      align="start"
      collisionPadding={16}
      className="flex w-auto max-w-[calc(100vw-2rem)] min-w-[min(20rem,calc(100vw-2rem))] flex-col p-0"
    >
      <SearchRow query={query} onQuery={setQuery} count={chosen.length} onClear={props.onClear} />
      {query.trim() === "" ? (
        <Columns {...props} options={available} />
      ) : (
        <MatchList {...props} options={available} query={query.trim().toLowerCase()} />
      )}
      <HiddenNote count={hidden} noun="places" />
    </PopoverContent>
  );
}

/** The search box, and **Clear** while any place is chosen. */
function SearchRow({
  query,
  onQuery,
  count,
  onClear,
}: {
  query: string;
  onQuery: (query: string) => void;
  count: number;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search places</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search places…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      {count > 0 && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
          Clear ({count})
        </Button>
      )}
    </div>
  );
}

/**
 * The columns: the countries, then what's in each one opened. Opening a place in a column closes
 * the columns after it. The newest column scrolls into view.
 */
function Columns(props: PanelProps) {
  const [opened, setOpened] = useState(() => startColumns(props.options, props.selected ?? []));
  const scroller = useRef<HTMLDivElement>(null);
  const columns = columnsOf(props.options, opened);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [opened]);
  if (props.options.length === 0) return <Empty />;
  return (
    <div ref={scroller} className="flex max-h-80 overflow-x-auto">
      {columns.map((column, depth) => (
        <Column
          key={column.parent?.id ?? "top"}
          {...props}
          column={column}
          openedId={opened[depth]}
          onOpen={(id) => setOpened([...opened.slice(0, depth), id])}
        />
      ))}
    </div>
  );
}

/** One column: the place it's in (none for the countries) and what's in it. */
interface PlaceColumn {
  parent?: LocationOption;
  options: LocationOption[];
}

/** The countries' column, then a column for each opened place that has something in it. */
function columnsOf(options: LocationOption[], opened: string[]): PlaceColumn[] {
  const every = everyOption(options);
  const parents = opened.flatMap((id) => every.filter((option) => option.id === id));
  return [{ options }, ...parents.map((parent) => ({ parent, options: parent.children }))];
}

/** A column's heading, its **All of** row on the Map, and its places. */
function Column({
  column,
  openedId,
  onOpen,
  ...props
}: PanelProps & { column: PlaceColumn; openedId?: string; onOpen: (id: string) => void }) {
  return (
    <div
      role="group"
      aria-label={columnName(column.options)}
      className="flex w-40 shrink-0 flex-col overflow-y-auto border-r p-1 last:border-r-0 sm:w-48"
    >
      <span className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
        {columnName(column.options)}
      </span>
      <AllOf parent={column.parent} {...props} />
      {column.options.map((option) => (
        <PlaceRow
          key={option.id}
          {...props}
          option={option}
          open={option.id === openedId}
          onOpen={() => onOpen(option.id)}
        />
      ))}
    </div>
  );
}

/** On the Map, a row at the top of a column picking the place it's in, such as "All of Japan". */
function AllOf({ parent, selected, onChoose, onHover }: PanelProps & { parent?: LocationOption }) {
  const { script } = useScriptDisplay();
  if (!parent || selected) return null;
  return (
    <button
      type="button"
      onClick={() => onChoose(valueOf(parent))}
      {...hoverHandlers(onHover, valueOf(parent))}
      className={cn(ROW_CLASS, "flex-none font-medium")}
    >
      <span className="truncate">All of {parent.label[script]}</span>
      <Count count={parent.count} />
    </button>
  );
}

const ROW_CLASS =
  "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm outline-none select-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A place in a column: its checkbox when places can be chosen, then its name and count, which opens
 * what's in it as the next column, or, for a place with nothing in it, chooses it.
 */
function PlaceRow({
  option,
  open,
  onOpen,
  ...props
}: PanelProps & { option: LocationOption; open: boolean; onOpen: () => void }) {
  const { script } = useScriptDisplay();
  const value = valueOf(option);
  const hasChildren = option.children.length > 0;
  return (
    <div className={cn("flex items-center gap-1 rounded-sm pl-1", open && "bg-accent")}>
      <RowCheckbox {...props} value={value} name={option.label[script]} />
      <button
        type="button"
        aria-expanded={hasChildren ? open : undefined}
        onClick={hasChildren ? onOpen : () => props.onChoose(value)}
        {...hoverHandlers(props.onHover, value)}
        className={ROW_CLASS}
      >
        <span className="truncate">{option.label[script]}</span>
        <Count count={option.count} />
        <Chevron shown={hasChildren} />
      </button>
    </div>
  );
}

/** A place's checkbox, while places can be chosen. */
function RowCheckbox({
  selected,
  onChoose,
  value,
  name,
}: PanelProps & { value: string; name: string }) {
  if (!selected) return null;
  return (
    <input
      type="checkbox"
      aria-label={name}
      checked={selected.includes(value)}
      onChange={() => onChoose(value)}
      className="size-4 shrink-0 cursor-pointer accent-primary"
    />
  );
}

/** How many photos a place would show. */
function Count({ count }: { count: number }) {
  return <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>;
}

/** The arrow after a place with others in it; a gap the same width for one without. */
function Chevron({ shown }: { shown: boolean }) {
  if (!shown) return <span className="size-4 shrink-0" aria-hidden />;
  return <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />;
}

/** What the flyout says when no place has photos. */
function Empty() {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">No places found.</p>;
}

/** Every place matching the search, each with what it's in under its name. */
function MatchList({ query, ...props }: PanelProps & { query: string }) {
  const { script } = useScriptDisplay();
  const matches = placeMatches(props.options, query, script);
  if (matches.length === 0) return <Empty />;
  return (
    <div className="flex max-h-80 w-[min(24rem,calc(100vw-2rem))] flex-col overflow-y-auto p-1">
      {matches.map((match) => (
        <MatchRow key={match.option.id} match={match} {...props} />
      ))}
    </div>
  );
}

/** A place found by the search: its checkbox when places can be chosen, its name, what it's in and its count. */
function MatchRow({ match: { option, path }, ...props }: PanelProps & { match: PlaceMatch }) {
  const { script } = useScriptDisplay();
  const value = valueOf(option);
  return (
    <div className="flex items-center gap-1 rounded-sm pl-1">
      <RowCheckbox {...props} value={value} name={option.label[script]} />
      <button
        type="button"
        onClick={() => props.onChoose(value)}
        {...hoverHandlers(props.onHover, value)}
        className={ROW_CLASS}
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{option.label[script]}</span>
          <span className="truncate text-xs text-muted-foreground">{path.join(" › ")}</span>
        </span>
        <Count count={option.count} />
      </button>
    </div>
  );
}

/** Tells onHover when a place is pointed at or focused, and when it no longer is. */
function hoverHandlers(onHover: PanelProps["onHover"], value: string) {
  if (!onHover) return {};
  const enter = () => onHover(value);
  const leave = () => onHover(undefined);
  return { onMouseEnter: enter, onMouseLeave: leave, onFocus: enter, onBlur: leave };
}
