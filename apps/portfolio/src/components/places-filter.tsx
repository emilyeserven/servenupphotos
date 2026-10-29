import { ChevronRight, ChevronsUpDown, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { useScriptDisplay } from "@/components/script-display-provider";
import { ClearFilterButton } from "@/components/clear-filter-button";
import { HiddenNote } from "@/components/hidden-note";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LocationOption } from "@/lib/filter-options";
import type { ScriptDisplay } from "@/lib/localize";
import { cn } from "@/lib/utils";

/** A choice's value as the Places filter keeps it: its key and value, such as "city:Seoul". */
function valueOf(option: LocationOption): string {
  return `${option.key}:${option.value}`;
}

/** Every choice in the tree, each before what's in it. */
function everyOption(options: LocationOption[]): LocationOption[] {
  return options.flatMap((option) => [option, ...everyOption(option.children)]);
}

/** The IDs of the choices that have something in them, which can be expanded. */
function expandableIds(options: LocationOption[]): string[] {
  return everyOption(options)
    .filter((option) => option.children.length > 0)
    .map((option) => option.id);
}

/** The IDs of the choices with a chosen one somewhere inside, so they start expanded to show it. */
function idsAroundChosen(options: LocationOption[], selected: string[]): string[] {
  return everyOption(options)
    .filter((option) =>
      everyOption(option.children).some((inside) => selected.includes(valueOf(inside))),
    )
    .map((option) => option.id);
}

/**
 * The choices expanded every time the tree opens, besides those around the chosen ones: the
 * United States of America, so its states show without a click, as it has photos in several.
 */
const START_EXPANDED = ["/country:United States of America"];

/**
 * The choices that would show any photos, given the other filters, each with what's in it that
 * would; a chosen one, or one with a chosen one inside, stays so it can be unchosen.
 */
function withPhotos(options: LocationOption[], selected: string[]): LocationOption[] {
  return options.flatMap((option) => {
    const children = withPhotos(option.children, selected);
    const keep = option.count > 0 || selected.includes(valueOf(option)) || children.length > 0;
    return keep ? [{ ...option, children }] : [];
  });
}

/** Whether the choice's name, written the way it's shown or in English, has the search in it. */
function nameHas(option: LocationOption, query: string, script: ScriptDisplay): boolean {
  const names = [option.label[script], option.label.english];
  return names.some((name) => name.toLowerCase().includes(query));
}

/**
 * The choices whose names have the search in them, each with the choices it's in above it and
 * everything in it below; every choice when there's no search.
 */
function matching(
  options: LocationOption[],
  query: string,
  script: ScriptDisplay,
): LocationOption[] {
  if (query === "") return options;
  return options.flatMap((option) => {
    if (nameHas(option, query, script)) return [option];
    const children = matching(option.children, query, script);
    return children.length > 0 ? [{ ...option, children }] : [];
  });
}

/** What the button says: "All places", the one place's name, or how many are chosen. */
function buttonText(options: LocationOption[], selected: string[], script: ScriptDisplay): string {
  if (selected.length === 0) return "All places";
  if (selected.length > 1) return `${selected.length} places`;
  const chosen = everyOption(options).find((option) => valueOf(option) === selected[0]);
  return chosen ? chosen.label[script] : "1 place";
}

/**
 * The **Places** filter: a button opening a searchable tree of every country, city and place the
 * photos were taken in, with a checkbox for each, so any number can be chosen. Each country, city
 * or place with others in it can be expanded or collapsed, or all at once with **Expand all** and
 * **Collapse all**. `selected` holds the chosen ones' values, such as "city:Seoul".
 */
export function PlacesFilter({
  options,
  selected,
  onChange,
}: {
  options: LocationOption[];
  selected: string[];
  onChange: (selection: string[]) => void;
}) {
  const { script } = useScriptDisplay();
  const text = buttonText(options, selected, script);

  /** Chooses the place, or unchooses it when it's chosen. */
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((chosen) => chosen !== value)
        : [...selected, value],
    );
  }

  return (
    <Popover>
      {/* The X sits over the button, inside its border, as a button can't hold another. */}
      <div className="relative inline-flex max-w-56 items-center">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-label={`Places: ${text}`}
            className={cn(
              "w-full font-normal has-[>svg]:pr-8",
              selected.length > 0 && "has-[>svg]:pr-14",
            )}
          >
            <MapPin aria-hidden className="text-muted-foreground" />
            <span className="truncate">{text}</span>
          </Button>
        </PopoverTrigger>
        {selected.length > 0 && (
          <ClearFilterButton
            label="Places"
            onClear={() => onChange([])}
            className="absolute right-7"
          />
        )}
        <ChevronsUpDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 size-4 opacity-50"
        />
      </div>
      <PlacesPanel
        options={options}
        selected={selected}
        onChoose={toggle}
        onClear={() => onChange([])}
      />
    </Popover>
  );
}

/**
 * The flyout of a Places button: a search, **Expand all** and **Collapse all**, and the tree of
 * places. Each place has a checkbox, or, without `selected`, is a button that picks just it, as
 * on the map, where picking a place moves the map there. `onChoose` gets the place's value, such
 * as "city:Seoul".
 */
export function PlacesPanel({
  options,
  selected,
  onChoose,
  onClear,
}: {
  options: LocationOption[];
  /** The chosen places' values, for a tree with checkboxes; left out for one that picks a place. */
  selected?: string[];
  onChoose: (value: string) => void;
  /** Unchooses every place, from the toolbar's **Clear**. */
  onClear?: () => void;
}) {
  const { script } = useScriptDisplay();
  const chosen = selected ?? [];
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(
    () => new Set([...START_EXPANDED, ...idsAroundChosen(options, chosen)]),
  );
  const searching = query.trim() !== "";
  const available = withPhotos(options, chosen);
  const hidden = everyOption(options).length - everyOption(available).length;
  const shown = matching(available, query.trim().toLowerCase(), script);

  /** Expands the choice, or collapses it when it's expanded. */
  function toggleExpanded(id: string) {
    const next = new Set(expanded);
    if (!next.delete(id)) next.add(id);
    setExpanded(next);
  }

  return (
    <PopoverContent align="start" className="flex w-[min(20rem,calc(100vw-2rem))] flex-col p-0">
      <label className="flex items-center gap-2 border-b px-3">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search places</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search places…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <PlacesToolbar
        selectedCount={chosen.length}
        searching={searching}
        onExpandAll={() => setExpanded(new Set(expandableIds(available)))}
        onCollapseAll={() => setExpanded(new Set())}
        onClear={onClear}
      />
      <div className="max-h-80 overflow-y-auto p-1">
        {shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No places found.</p>
        ) : (
          <PlaceList
            options={shown}
            depth={0}
            isExpanded={(id) => searching || expanded.has(id)}
            isChosen={selected && ((option) => chosen.includes(valueOf(option)))}
            onToggle={(option) => onChoose(valueOf(option))}
            onToggleExpanded={toggleExpanded}
          />
        )}
        <HiddenNote count={hidden} noun="places" />
      </div>
    </PopoverContent>
  );
}

/** **Expand all** and **Collapse all**, hidden while searching, which shows every match expanded, and **Clear**. */
function PlacesToolbar({
  selectedCount,
  searching,
  onExpandAll,
  onCollapseAll,
  onClear,
}: {
  selectedCount: number;
  searching: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClear?: () => void;
}) {
  const button = "h-7 px-2 text-xs";
  return (
    <div className="flex items-center gap-1 border-b px-1 py-1">
      {!searching && (
        <>
          <Button variant="ghost" size="sm" className={button} onClick={onExpandAll}>
            Expand all
          </Button>
          <Button variant="ghost" size="sm" className={button} onClick={onCollapseAll}>
            Collapse all
          </Button>
        </>
      )}
      {selectedCount > 0 && (
        <Button variant="ghost" size="sm" className={cn(button, "ml-auto")} onClick={onClear}>
          Clear ({selectedCount})
        </Button>
      )}
    </div>
  );
}

interface PlaceListProps {
  options: LocationOption[];
  /** How deep the list is in the tree, which indents it. */
  depth: number;
  isExpanded: (id: string) => boolean;
  /** Whether the place is chosen, for a tree with checkboxes; left out for one that picks a place. */
  isChosen?: (option: LocationOption) => boolean;
  onToggle: (option: LocationOption) => void;
  onToggleExpanded: (id: string) => void;
}

/** The choices, each with a checkbox and what's in it below when it's expanded. */
function PlaceList(props: PlaceListProps) {
  return (
    <ul role={props.depth === 0 ? undefined : "group"}>
      {props.options.map((option) => (
        <PlaceItem key={option.id} option={option} {...props} />
      ))}
    </ul>
  );
}

function PlaceItem({ option, ...props }: PlaceListProps & { option: LocationOption }) {
  const { script } = useScriptDisplay();
  const open = props.isExpanded(option.id);
  const name = option.label[script];
  return (
    <li>
      <div
        className="flex items-center gap-0.5"
        style={{ paddingLeft: `${props.depth * 1.25}rem` }}
      >
        <ExpandButton
          name={name}
          hasChildren={option.children.length > 0}
          open={open}
          onClick={() => props.onToggleExpanded(option.id)}
        />
        <PlaceChoice option={option} name={name} {...props} />
      </div>
      {open && option.children.length > 0 && (
        <PlaceList {...props} options={option.children} depth={props.depth + 1} />
      )}
    </li>
  );
}

const CHOICE_CLASS =
  "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm select-none hover:bg-accent";

/** A place's name and count: with a checkbox, or as a button that picks it without `isChosen`. */
function PlaceChoice({
  option,
  name,
  isChosen,
  onToggle,
}: PlaceListProps & { option: LocationOption; name: string }) {
  const label = (
    <>
      <span className="truncate">{name}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{option.count}</span>
    </>
  );
  if (!isChosen) {
    return (
      <button
        type="button"
        onClick={() => onToggle(option)}
        className={cn(CHOICE_CLASS, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {label}
      </button>
    );
  }
  return (
    <label className={CHOICE_CLASS}>
      <input
        type="checkbox"
        checked={isChosen(option)}
        onChange={() => onToggle(option)}
        className="size-4 shrink-0 cursor-pointer accent-primary"
      />
      {label}
    </label>
  );
}

/** The chevron that expands or collapses a choice with others in it; a gap for one without. */
function ExpandButton({
  name,
  hasChildren,
  open,
  onClick,
}: {
  name: string;
  hasChildren: boolean;
  open: boolean;
  onClick: () => void;
}) {
  if (!hasChildren) return <span className="size-6 shrink-0" aria-hidden />;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
      onClick={onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight
        aria-hidden
        className={cn("size-4 transition-transform", open && "rotate-90")}
      />
    </button>
  );
}
