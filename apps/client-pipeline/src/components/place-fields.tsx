import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  cacheSavedEntry,
  entryId,
  type Localization,
  localizationId,
  type Place,
  type PhotoPlace,
  placePhrase,
  placesQuery,
  RELATIONS,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** What PlaceFields edits: the photo's places, and the place name the portfolio shows. */
interface PlaceValue {
  places: PhotoPlace[];
  placeName: string;
}

/** A place row with nothing chosen yet. */
const NO_PLACE: PhotoPlace = { relation: "", id: "" };

/** The places as a map from ID to name, for showing them. */
function placeNames(places: Place[]): Map<string, string> {
  return new Map(places.map((place) => [place.id, place.name || place.id]));
}

/** The first place chosen, if any. */
function firstChosen(places: PhotoPlace[]): PhotoPlace | undefined {
  return places.find((place) => place.id);
}

/**
 * The place name to keep with places: the first chosen place's name, so the portfolio keeps
 * showing a name; empty once the places that set it are all removed; or else the one written before
 * there were places, as it was.
 */
function nextPlaceName(previous: PlaceValue, places: PhotoPlace[], names: Map<string, string>) {
  const first = firstChosen(places);
  if (first) return names.get(first.id) ?? first.id;
  return firstChosen(previous.places) ? "" : previous.placeName;
}

/** The place's local script and romanization, from its localization, as a second line. */
function placeDetail(place: Place, localizations: Localization[]): string | undefined {
  const id = localizationId("place", place.name, place.id);
  const found = localizations.find((l) => l.id === id);
  const parts = [found?.localScript, found?.romanization, place.description].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Every place, read with the Places page's query, and saving a new one from a combobox. */
function usePlaces() {
  const queryClient = useQueryClient();
  const read = useQuery(placesQuery);
  const places = readEntries(read.data?.places);
  const localizations = readEntries(read.data?.localizations);
  const save = useMutation({
    ...savePlaceMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "places", result),
  });
  /** Adds a place named name, then calls onCreated with its ID, unless another place has that ID. */
  const create = (
    name: string,
    onCreated: (id: string) => void,
    onError: (message: string) => void,
  ) => {
    const id = entryId(name);
    const taken = places.find((place) => place.id === id);
    if (taken) return onError(`“${taken.name}” already has the ID ${id}. Choose it instead.`);
    save.mutate(
      { id, name, description: "" },
      { onSuccess: () => onCreated(id), onError: (e) => onError(e.message) },
    );
  };
  const options: ComboboxOption[] = places
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((place) => ({
      value: place.id,
      label: place.name || place.id,
      detail: placeDetail(place, localizations),
    }));
  /** True until the places are read, and while one is being added. */
  const busy = !read.data || save.isPending;
  return { read, places, names: placeNames(places), options, save, create, busy };
}

type Places = ReturnType<typeof usePlaces>;

interface PlaceFieldsProps {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  disabled: boolean;
}

/**
 * Where the photo was taken: one place from PLACES.json, or two, each with how the photo relates to
 * it ("In Gyeongbokgung Palace by Geunjeongmun Gate"), or one with just a relation ("Near
 * Gyeongbokgung"). A place can be added from what's typed. The first place's name is kept as the
 * place name the portfolio shows.
 */
export function PlaceFields({ value, onChange, disabled }: PlaceFieldsProps) {
  const all = usePlaces();
  // The place name as the photo was saved, kept while editing even once places replace it.
  const [oldName] = useState(() => (hasOldPlaceName(value) ? value.placeName.trim() : ""));
  const rows = value.places.length > 0 ? value.places : [NO_PLACE];
  const setRows = (places: PhotoPlace[]) =>
    onChange({ places, placeName: nextPlaceName(value, places, all.names) });
  const setRow = (index: number, row: PhotoPlace) => setRows(rows.with(index, row));
  return (
    <div className="flex flex-col gap-2">
      <PlaceLabel />
      {oldName && <OldPlaceName name={oldName} />}
      {rows.map((row, index) => (
        <PlaceRow
          key={index}
          index={index}
          row={row}
          all={all}
          disabled={disabled}
          onChange={(next) => setRow(index, next)}
          onRemove={index > 0 ? () => setRows(rows.toSpliced(index, 1)) : undefined}
        />
      ))}
      <PlaceFooter
        rows={rows}
        all={all}
        disabled={disabled}
        onAddSecond={() => setRows([...rows, { relation: "by", id: "" }])}
      />
    </div>
  );
}

function PlaceLabel() {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span id="photo-place-label" className="text-sm font-medium">
        Place
      </span>
      <Link
        to="/places"
        className="text-muted-foreground text-xs underline-offset-4 hover:underline"
      >
        Manage places
      </Link>
    </div>
  );
}

interface PlaceRowProps {
  index: number;
  row: PhotoPlace;
  all: Places;
  disabled: boolean;
  onChange: (row: PhotoPlace) => void;
  /** Removes the row; the first row has none. */
  onRemove?: () => void;
}

/** How the photo relates to one place, and which place. */
function PlaceRow({ index, row, all, disabled, onChange, onRemove }: PlaceRowProps) {
  const [error, setError] = useState<string>();
  const create = (name: string) => {
    setError(undefined);
    all.create(name, (id) => onChange({ ...row, id }), setError);
  };
  const shown = rowError(error, all);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <RelationSelect
          id={`photo-place-relation-${index}`}
          value={row.relation}
          disabled={disabled}
          onChange={(relation) => onChange({ ...row, relation })}
        />
        <PlaceCombobox
          index={index}
          row={row}
          all={all}
          disabled={disabled}
          onChange={onChange}
          onCreate={create}
        />
        {onRemove && <RemoveButton disabled={disabled} onRemove={onRemove} />}
      </div>
      {shown && <p className="text-destructive text-sm">{shown}</p>}
    </div>
  );
}

/** Why adding a place failed, or why the places couldn't be read. */
function rowError(error: string | undefined, all: Places): string | undefined {
  return error ?? all.read.error?.message;
}

/** Which place, typed to filter, or to add a new one. */
function PlaceCombobox({
  index,
  row,
  all,
  disabled,
  onChange,
  onCreate,
}: Omit<PlaceRowProps, "onRemove"> & { onCreate: (name: string) => void }) {
  return (
    <div className="min-w-0 flex-1">
      <Combobox
        id={`photo-place-${index}`}
        aria-labelledby="photo-place-label"
        options={all.options}
        value={row.id ? [row.id] : []}
        onChange={([id]) => onChange({ ...row, id: id ?? "" })}
        disabled={disabled || all.busy}
        placeholder={placeholder(index, all)}
        emptyText="Type a name to add a place."
        createLabel={(text) => `Add “${text}” as a place`}
        onCreate={onCreate}
        unknownLabel={(id) => `${id}, which isn't a place on GitHub`}
      />
    </div>
  );
}

function RemoveButton({ disabled, onRemove }: { disabled: boolean; onRemove: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove the second place"
      disabled={disabled}
      onClick={onRemove}
    >
      <XIcon />
    </Button>
  );
}

function placeholder(index: number, all: Places): string {
  if (all.read.isPending) return "Reading places from GitHub…";
  if (all.save.isPending) return "Adding the place…";
  return index === 0 ? "Such as Gyeongbokgung Palace" : "Such as Geunjeongmun Gate";
}

interface RelationSelectProps {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** How the photo relates to a place, such as "in" or "near"; none just names the place. */
function RelationSelect({ id, value, disabled, onChange }: RelationSelectProps) {
  return (
    <select
      id={id}
      aria-label="How the photo relates to the place"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "border-input dark:bg-input/30 h-9 w-32 shrink-0 rounded-md border bg-transparent px-2 text-sm shadow-xs",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] disabled:opacity-50",
      )}
    >
      <option value="">(none)</option>
      {RELATIONS.map((relation) => (
        <option key={relation} value={relation}>
          {relation}
        </option>
      ))}
    </select>
  );
}

interface PlaceFooterProps {
  rows: PhotoPlace[];
  all: Places;
  disabled: boolean;
  onAddSecond: () => void;
}

/** The places as a phrase, and adding a second place. */
function PlaceFooter({ rows, all, disabled, onAddSecond }: PlaceFooterProps) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">{phraseText(rows, all.names)}</span>
        {rows.length === 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onAddSecond}
          >
            <PlusIcon /> Add a second place
          </Button>
        )}
      </div>
    </div>
  );
}

/** The places as a quoted phrase, or what to do when none is chosen. */
function phraseText(rows: PhotoPlace[], names: Map<string, string>): string {
  const phrase = placePhrase(rows, names);
  return phrase ? `“${phrase}”` : "Choose a place, and how the photo relates to it.";
}

/** Whether the photo has a place name but no places, as photos saved before places do. */
function hasOldPlaceName(value: PlaceValue): boolean {
  return !firstChosen(value.places) && Boolean(value.placeName.trim());
}

/**
 * The place name a photo was saved with before it had places, read-only, to choose or add the
 * matching places by. Once the photo is saved with places, it isn't shown anymore.
 */
function OldPlaceName({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="photo-old-place-name" className="text-muted-foreground text-xs">
        Place name saved before places, for reference
      </label>
      <Input id="photo-old-place-name" value={name} readOnly className="bg-muted/50" />
    </div>
  );
}
