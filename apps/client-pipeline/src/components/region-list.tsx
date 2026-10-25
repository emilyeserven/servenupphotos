import { ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { type Localization, type Place, type PlacesResponse } from "@/api/places";
import { InferredPlaceList } from "@/components/inferred-place-list";
import { PlaceBulkBar } from "@/components/place-bulk-bar";
import { PlaceGpsCell } from "@/components/place-gps-cell";
import { RegionIcon, type RegionIconKind } from "@/components/region-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CombinedPhoto } from "@/lib/group-photos";
import type { LocationNames } from "@/lib/location-names";
import { cn } from "@/lib/utils";
import {
  type RegionNode,
  type RegionTreeRow,
  regionParentKeys,
  regionTreeRows,
} from "@/lib/region-tree";

/** Everything the Places list shows, worked out from the place files and the photos. */
export interface RegionListData {
  data: PlacesResponse;
  places: Place[];
  nodes: RegionNode[];
  /** The localization of each node, by its key. */
  localizations: ReadonlyMap<string, Localization>;
  /** How many photos listing each place can't go on the map, by place ID. */
  unmapped: ReadonlyMap<string, number>;
  /** Every photo, as the next Commit will have it. */
  photos: CombinedPhoto[];
  /** The names that win over other names of a country or city, which the list counts them as. */
  names: LocationNames;
}

interface RegionListProps {
  list: RegionListData;
  /** The key of the row being edited, or "" for none. */
  selected: string;
  onSelect: (node: RegionNode) => void;
  onNew: () => void;
}

/**
 * Every country, the cities in each, and the places in each city, as one tree that can be collapsed
 * and searched. Choosing a row edits it in the panel beside the list.
 */
export function RegionList({ list, selected, onSelect, onNew }: RegionListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Countries, cities and places</CardTitle>
          <CardDescription>Read on {list.data.branch}.</CardDescription>
        </div>
        <Button type="button" size="sm" onClick={onNew}>
          <PlusIcon />
          New place
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <RegionTree list={list} selected={selected} onSelect={onSelect} />
        <UnreadableFiles files={list.data.places} />
        <InferredPlaceList places={list.places} />
      </CardContent>
    </Card>
  );
}

type RegionTreeProps = Omit<RegionListProps, "onNew">;

function RegionTree({ list, selected, onSelect }: RegionTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  if (list.nodes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No places yet. Add one with New place, or from a photo's Place field.
      </p>
    );
  }
  const rows = regionTreeRows(list.nodes, { collapsed, search });
  const toggle = (key: string) => setCollapsed(toggled(collapsed, key));
  const checkedPlaces = list.places.filter((place) => checked.has(place.id));
  const shownIds = rows.flatMap((row) => (row.node.place ? [row.node.place.id] : []));
  return (
    <>
      {checkedPlaces.length > 0 && (
        <PlaceBulkBar
          selected={checkedPlaces}
          places={list.places}
          onClear={() => setChecked(new Set())}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox value={search} onChange={setSearch} />
        <ExpandButtons
          parents={regionParentKeys(list.nodes)}
          collapsed={collapsed}
          onChange={setCollapsed}
          disabled={search.trim() !== ""}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <CheckAll shown={shownIds} checked={checked} onChange={setChecked} />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Local script</TableHead>
            <TableHead className="text-center">GPS</TableHead>
            <TableHead className="text-right">Photos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <RegionRow
              key={row.node.key}
              row={row}
              list={list}
              open={!collapsed.has(row.node.key) || search.trim() !== ""}
              selected={row.node.key === selected}
              checked={checked}
              onCheck={setChecked}
              onToggle={() => toggle(row.node.key)}
              onSelect={() => onSelect(row.node)}
            />
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">Nothing is named like that.</p>
      )}
    </>
  );
}

/** Narrows the list to the names with the text in them, and what they're in. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        aria-label="Search countries, cities and places"
        placeholder="Search"
        className="pl-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function toggled(collapsed: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(collapsed);
  if (!next.delete(key)) next.add(key);
  return next;
}

interface ExpandButtonsProps {
  /** Every row that has rows under it. */
  parents: Set<string>;
  collapsed: ReadonlySet<string>;
  onChange: (collapsed: ReadonlySet<string>) => void;
  /** While searching, everything that matches is shown open. */
  disabled: boolean;
}

/** Expand all and Collapse all, shown once any row has rows under it. */
function ExpandButtons({ parents, collapsed, onChange, disabled }: ExpandButtonsProps) {
  if (parents.size === 0) return null;
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || collapsed.size === 0}
        onClick={() => onChange(new Set())}
      >
        Expand all
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || [...parents].every((key) => collapsed.has(key))}
        onClick={() => onChange(parents)}
      >
        Collapse all
      </Button>
    </div>
  );
}

/** The files that couldn't be read, and why. */
function UnreadableFiles({ files }: { files: PlacesResponse["places"] }) {
  return files
    .filter((file) => file.error)
    .map((file) => (
      <p key={file.path} className="text-destructive text-sm">
        {file.path}: {file.error}
      </p>
    ));
}

/** A city only photos show, which no place is in yet. */
function isInferredCity(node: RegionNode): boolean {
  return node.kind === "city" && node.region?.places === 0;
}

/** What's shown under a row's name: a place's ID and description, or that a city is only on photos. */
function rowNote(node: RegionNode): string {
  if (node.place) return [node.place.id, node.place.description].filter(Boolean).join(" · ");
  return isInferredCity(node) ? "Inferred from photos" : "";
}

interface RegionRowProps {
  row: RegionTreeRow;
  list: RegionListData;
  /** Whether the rows under it are shown. */
  open: boolean;
  /** Whether it's the row being edited. */
  selected: boolean;
  /** The IDs of the places checked for bulk editing. */
  checked: ReadonlySet<string>;
  onCheck: (checked: ReadonlySet<string>) => void;
  onToggle: () => void;
  onSelect: () => void;
}

function RegionRow({
  row,
  list,
  open,
  selected,
  checked,
  onCheck,
  onToggle,
  onSelect,
}: RegionRowProps) {
  const { node } = row;
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell className="align-top">
        {node.place && <PlaceCheckbox place={node.place} checked={checked} onChange={onCheck} />}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex items-start gap-1" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
          <ToggleButton row={row} open={open} onToggle={onToggle} />
          <NameButton node={node} state={row.state} selected={selected} onSelect={onSelect} />
        </div>
      </TableCell>
      <TableCell>
        <LocalScript localization={list.localizations.get(node.key)} />
      </TableCell>
      <TableCell className="text-center">
        <GpsCell node={node} list={list} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{node.photos}</TableCell>
    </TableRow>
  );
}

interface NameButtonProps {
  node: RegionNode;
  /** The state of the same name the city stands in for, whose icon shows before the city's. */
  state?: RegionNode;
  selected: boolean;
  onSelect: () => void;
}

/** The row's kind, or "exact" for a place marked as an exact location. */
function iconKind(node: RegionNode): RegionIconKind {
  return node.place?.exactLocation ? "exact" : node.kind;
}

/** The row's icon and name, with its note under it, as a button that edits it. */
function NameButton({ node, state, selected, onSelect }: NameButtonProps) {
  const note = rowNote(node);
  return (
    <button
      type="button"
      className="focus-visible:ring-ring/50 flex min-w-0 items-start gap-2 rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px]"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <NameIcons node={node} state={state} />
      <span className="min-w-0">
        <span className={cn("block", node.kind !== "place" && "font-medium")}>{node.name}</span>
        {note && <span className="text-muted-foreground block text-xs">{note}</span>}
      </span>
    </button>
  );
}

/** The row's icon, after the state's when the city stands in for a state of its name. */
function NameIcons({ node, state }: { node: RegionNode; state?: RegionNode }) {
  if (!state) return <RegionIcon kind={iconKind(node)} className="mt-0.5" />;
  return (
    <span className="mt-0.5 flex shrink-0 gap-0.5">
      <RegionIcon kind="state" />
      <RegionIcon kind={iconKind(node)} />
    </span>
  );
}

const CHECKBOX = "accent-primary mt-0.5 size-4 cursor-pointer align-middle";

interface PlaceCheckboxProps {
  place: Place;
  checked: ReadonlySet<string>;
  onChange: (checked: ReadonlySet<string>) => void;
}

/** Checks or unchecks the place for bulk editing. */
function PlaceCheckbox({ place, checked, onChange }: PlaceCheckboxProps) {
  return (
    <input
      type="checkbox"
      className={CHECKBOX}
      aria-label={`Check ${place.name}`}
      checked={checked.has(place.id)}
      onChange={() => onChange(toggled(checked, place.id))}
    />
  );
}

/** The checked IDs, less the ones in ids. */
function without(checked: ReadonlySet<string>, ids: string[]): Set<string> {
  return new Set([...checked].filter((id) => !ids.includes(id)));
}

interface CheckAllProps {
  /** The IDs of the places in the list as it's shown. */
  shown: string[];
  checked: ReadonlySet<string>;
  onChange: (checked: ReadonlySet<string>) => void;
}

/** Checks every place shown, or unchecks them all once they are; half checked when only some are. */
function CheckAll({ shown, checked, onChange }: CheckAllProps) {
  const count = shown.filter((id) => checked.has(id)).length;
  const all = shown.length > 0 && count === shown.length;
  return (
    <input
      type="checkbox"
      className={CHECKBOX}
      aria-label="Check every place shown"
      disabled={shown.length === 0}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = count > 0 && !all;
      }}
      onChange={() => onChange(all ? without(checked, shown) : new Set([...checked, ...shown]))}
    />
  );
}

/** The saved local script, or a muted dash. */
function LocalScript({ localization }: { localization: Localization | undefined }) {
  return localization?.localScript || <span className="text-muted-foreground">–</span>;
}

/** A place's GPS icon; nothing for a city or country. */
function GpsCell({ node, list }: { node: RegionNode; list: RegionListData }) {
  if (!node.place) return null;
  const unmapped = list.unmapped.get(node.place.id) ?? 0;
  return <PlaceGpsCell place={node.place} places={list.places} unmapped={unmapped} />;
}

interface ToggleButtonProps {
  row: RegionTreeRow;
  open: boolean;
  onToggle: () => void;
}

/** The arrow that shows or hides the rows under a row, or a space the same size when it has none. */
function ToggleButton({ row, open, onToggle }: ToggleButtonProps) {
  if (!row.hasChildren) return <span className="size-5 shrink-0" />;
  const action = open ? "Collapse" : "Expand";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-5 shrink-0"
      aria-expanded={open}
      aria-label={`${action} ${row.node.name}`}
      onClick={onToggle}
    >
      <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
    </Button>
  );
}
