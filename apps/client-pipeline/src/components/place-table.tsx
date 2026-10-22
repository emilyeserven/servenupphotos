import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import {
  localizationId,
  type Localization,
  type Place,
  type PlacesResponse,
  readEntries,
} from "@/api/places";
import { InferredPlaceList } from "@/components/inferred-place-list";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parentIds, type PlaceTreeRow, placeTreeRows } from "@/lib/place-tree";
import { placePhotoCounts, shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

interface PlaceTableProps {
  data: PlacesResponse;
  onEdit: (place: Place) => void;
}

/**
 * Every place, each parent followed by the places in it, which can be collapsed. Each row has the
 * place's local script and how many photos list it.
 */
export function PlaceTable({ data, onEdit }: PlaceTableProps) {
  const counts = placePhotoCounts(shownPhotos(useCombinedData().data));
  const localizations = readEntries(data.localizations);
  const places = readEntries(data.places);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  if (data.places.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          No places yet. Add one above, or from a photo's Place field.
        </p>
        <InferredPlaceList places={places} />
      </div>
    );
  }
  const toggle = (id: string) => setCollapsed(toggled(collapsed, id));
  return (
    <div className="flex flex-col gap-2">
      <ExpandButtons parents={parentIds(places)} collapsed={collapsed} onChange={setCollapsed} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Local script</TableHead>
            <TableHead className="text-right">Photos</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {placeTreeRows(places, collapsed).map((row) => (
            <PlaceRow
              key={row.place.id}
              row={row}
              open={!collapsed.has(row.place.id)}
              localization={localizationOf(localizations, row.place)}
              photos={counts.get(row.place.id) ?? 0}
              onToggle={() => toggle(row.place.id)}
              onEdit={() => onEdit(row.place)}
            />
          ))}
        </TableBody>
      </Table>
      <UnreadableFiles files={data.places} />
      <InferredPlaceList places={places} />
    </div>
  );
}

function toggled(collapsed: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(collapsed);
  if (!next.delete(id)) next.add(id);
  return next;
}

interface ExpandButtonsProps {
  /** Every place that has places in it. */
  parents: Set<string>;
  collapsed: ReadonlySet<string>;
  onChange: (collapsed: ReadonlySet<string>) => void;
}

/** Expand all and Collapse all, shown once any place has places in it. */
function ExpandButtons({ parents, collapsed, onChange }: ExpandButtonsProps) {
  if (parents.size === 0) return null;
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={collapsed.size === 0}
        onClick={() => onChange(new Set())}
      >
        Expand all
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={[...parents].every((id) => collapsed.has(id))}
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

/** What's known about where the place is, after its ID: its city and its description. */
function placeNotes(place: Place): string[] {
  const where = [place.city, place.country].filter(Boolean).join(", ");
  return [where, place.description].filter(Boolean) as string[];
}

function localizationOf(localizations: Localization[], place: Place): Localization | undefined {
  const id = localizationId("place", place.name, place.id);
  return localizations.find((l) => l.id === id);
}

interface PlaceRowProps {
  row: PlaceTreeRow;
  /** Whether the places in it are shown. */
  open: boolean;
  localization?: Localization;
  photos: number;
  onToggle: () => void;
  onEdit: () => void;
}

function PlaceRow({ row, open, localization, photos, onToggle, onEdit }: PlaceRowProps) {
  const { place } = row;
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="flex items-start gap-1" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
          <ToggleButton row={row} open={open} onToggle={onToggle} />
          <div>
            <div className="font-medium">{place.name}</div>
            <div className="text-muted-foreground text-xs">
              <code>{place.id}</code>
              {placeNotes(place).map((note) => ` · ${note}`)}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {localization?.localScript || <span className="text-muted-foreground">None</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{photos}</TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface ToggleButtonProps {
  row: PlaceTreeRow;
  open: boolean;
  onToggle: () => void;
}

/** The arrow that shows or hides the places in a place, or a space the same size when it has none. */
function ToggleButton({ row, open, onToggle }: ToggleButtonProps) {
  if (!row.hasChildren) return <span className="size-6 shrink-0" />;
  const action = open ? "Collapse" : "Expand";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-6 shrink-0"
      aria-expanded={open}
      aria-label={`${action} ${row.place.name}`}
      onClick={onToggle}
    >
      <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
    </Button>
  );
}
