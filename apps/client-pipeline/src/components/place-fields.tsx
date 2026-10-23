import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpDownIcon, FolderTreeIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  cacheSavedEntry,
  entryId,
  type Localization,
  localizationId,
  type Place,
  type PhotoPlace,
  placesQuery,
  RELATIONS,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { Button } from "@/components/ui/button";
import { type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { PhotoGpsStatus } from "@/components/photo-gps-status";
import { PlaceCityAdders } from "@/components/place-city-adder";
import { PlaceGpsAdders } from "@/components/place-gps-adder";
import { PlacesJoinWord } from "@/components/place-join-fields";
import { PlaceLocalizationDialog } from "@/components/place-localization-dialog";
import { SingleCombobox } from "@/components/ui/single-combobox";
import {
  isUnitedStates,
  placeCity,
  isLocalized,
  specificFirst,
  unrelatedPair,
  withParent,
} from "@/lib/place-hierarchy";
import { inferredName, inferredOptions, inferredPlaces } from "@/lib/inferred-places";
import { placePhrase, placesJoin } from "@/lib/place-joins";
import { shownPhotos } from "@/lib/place-seeds";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/**
 * What PlaceFields edits: the photo's places, the place name kept with them, and its custom city
 * and country, which choosing a place with a city fills in.
 */
interface PlaceValue {
  places: PhotoPlace[];
  placeName: string;
  customCity: string;
  customCountry: string;
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
function placeDetail(place: Place, found: Localization | undefined): string | undefined {
  const parts = [found?.localScript, found?.romanization, place.description].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** The place as an option, shown with its local script and romanization, and found by any of its names. */
function placeOption(place: Place, localizations: Localization[]): ComboboxOption {
  const id = localizationId("place", place.name, place.id);
  const found = localizations.find((l) => l.id === id);
  return {
    value: place.id,
    label: place.name || place.id,
    detail: placeDetail(place, found),
    keywords: found && [found.romanization, found.pronunciation, found.localScript].join(" "),
  };
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
  const inferred = inferredPlaces(shownPhotos(useCombinedData().data), places);
  const options: ComboboxOption[] = [
    ...places
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((place) => placeOption(place, localizations)),
    ...inferredOptions(inferred),
  ];
  /** True until the places are read, and while one is being added. */
  const busy = !read.data || save.isPending;
  return { read, places, localizations, names: placeNames(places), options, save, create, busy };
}

type Places = ReturnType<typeof usePlaces>;

interface PlaceFieldsProps {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  disabled: boolean;
  /** The country from the photo's EXIF, for telling whether it was taken in the United States. */
  exifCountry: string | null;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  /** The city from the photo's EXIF, offered as a place's city when its custom one is empty. */
  exifCity: string | null;
}

/**
 * rows after the place in row `index` changed: its parent added as the second place when it's the
 * only one, and the more specific place first.
 */
function afterChoosing(rows: PhotoPlace[], index: number, places: Place[]): PhotoPlace[] {
  return specificFirst(withParent(rows, index, places), places);
}

/** The custom city and country, filled in from the places when one of them has a city. */
function cityFor(value: PlaceValue, rows: PhotoPlace[], places: Place[]) {
  const { city = "", country = "" } = placeCity(rows, places) ?? {};
  return { customCity: city || value.customCity, customCountry: country || value.customCountry };
}

/** The country the photo was taken in, as far as is known: the custom one, or else the EXIF's. */
/** The city the photo shows: its custom one, or else its EXIF one. */
function photoCity(value: PlaceValue, exifCity: string | null): string {
  return value.customCity.trim() || exifCity || "";
}

function photoCountry(value: PlaceValue, exifCountry: string | null): string {
  return value.customCountry.trim() || exifCountry || "";
}

/**
 * Where the photo was taken: one place from PLACES.json, or two, each with how the photo relates to
 * it ("In Gyeongbokgung Palace by Geunjeongmun Gate"), or one with just a relation ("Near
 * Gyeongbokgung"). A place can be added from what's typed. The first place's name is kept as the
 * place name the portfolio shows.
 */
export function PlaceFields({
  value,
  onChange,
  disabled,
  exifCountry,
  exifGps,
  exifCity,
}: PlaceFieldsProps) {
  const all = usePlaces();
  // The place name as the photo was saved, kept while editing even once places replace it.
  const [oldName] = useState(() => (hasOldPlaceName(value) ? value.placeName.trim() : ""));
  const rows = value.places.length > 0 ? value.places : [NO_PLACE];
  const setRows = (places: PhotoPlace[], city = {}) =>
    onChange({ ...value, ...city, places, placeName: nextPlaceName(value, places, all.names) });
  const setRow = (index: number, row: PhotoPlace) => {
    if (row.id === rows[index]?.id) return setRows(rows.with(index, row));
    const next = afterChoosing(rows.with(index, row), index, all.places);
    setRows(next, cityFor(value, next, all.places));
  };
  const country = photoCountry(value, exifCountry);
  return (
    <div className="flex flex-col gap-2">
      <PlaceLabel />
      <PhotoGpsStatus exifGps={exifGps} rows={rows} places={all.places} />
      <PlaceGpsAdders rows={rows} places={all.places} exifGps={exifGps} disabled={disabled} />
      <PlaceCityAdders
        rows={rows}
        places={all.places}
        region={{ city: photoCity(value, exifCity), country }}
        disabled={disabled}
      />
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
          country={country}
          joined={placesJoin(rows, index, all.places)}
        />
      ))}
      <PlaceFooter
        rows={rows}
        all={all}
        disabled={disabled}
        onAddSecond={() => setRows([...rows, { relation: "by", id: "" }])}
        onSwap={() => setRows(swappedPlaces(rows))}
      />
      <ParentOffer rows={rows} all={all} disabled={disabled} />
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
  /** The country the photo was taken in, when known, to offer localizing places outside the US. */
  country: string;
  /** The word from the places, when this row's place is one the row above's is in; it replaces the relation menu. */
  joined: string | undefined;
}

/** How the photo relates to one place, and which place. */
function PlaceRow({
  index,
  row,
  all,
  disabled,
  onChange,
  onRemove,
  country,
  joined,
}: PlaceRowProps) {
  const [error, setError] = useState<string>();
  const create = (name: string) => {
    setError(undefined);
    all.create(name, (id) => onChange({ ...row, id }), setError);
  };
  const shown = rowError(error, all);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        {joined === undefined ? (
          <RelationSelect
            id={`photo-place-relation-${index}`}
            value={row.relation}
            disabled={disabled}
            onChange={(relation) => onChange({ ...row, relation })}
          />
        ) : (
          <PlacesJoinWord word={joined} />
        )}
        <PlaceCombobox
          index={index}
          row={row}
          all={all}
          disabled={disabled}
          onChange={onChange}
          onCreate={create}
        />
        <LocalizeButton id={row.id} all={all} country={country} disabled={disabled} />
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
}: Omit<PlaceRowProps, "onRemove" | "country" | "joined"> & { onCreate: (name: string) => void }) {
  return (
    <div className="min-w-0 flex-1">
      <SingleCombobox
        id={`photo-place-${index}`}
        aria-labelledby="photo-place-label"
        options={all.options}
        value={row.id}
        onChange={(id) => chooseOrSave(id, row, onChange, onCreate)}
        disabled={disabled || all.busy}
        placeholder={placeholder(index, all)}
        emptyText="No places yet. Type a name to add one."
        createLabel={(text) => `Add “${text}” as a place`}
        onCreate={onCreate}
      />
    </div>
  );
}

/** Chooses the place with the ID, or saves an inferred place as a place first and then chooses it. */
function chooseOrSave(
  value: string,
  row: PhotoPlace,
  onChange: (row: PhotoPlace) => void,
  onCreate: (name: string) => void,
) {
  const name = inferredName(value);
  if (name) onCreate(name);
  else onChange({ ...row, id: value });
}

interface LocalizeButtonProps {
  id: string;
  all: Places;
  country: string;
  disabled: boolean;
}

/**
 * Opens a dialog to localize the chosen place, when it has no localization yet and it, or else the
 * photo, isn't in the United States.
 */
function LocalizeButton({ id, all, country, disabled }: LocalizeButtonProps) {
  const place = all.places.find((p) => p.id === id);
  if (!place || !needsLocalizing(place, all, country)) return null;
  return <PlaceLocalizationDialog place={place} disabled={disabled} />;
}

/** Whether the place has no localization and isn't, as far as is known, in the United States. */
function needsLocalizing(place: Place, all: Places, country: string): boolean {
  return !isLocalized(place, all.localizations) && !isUnitedStates(place.country || country);
}

/**
 * When two places are chosen and neither is in the other, offers to put the first in the second,
 * so choosing the first again adds the second on its own.
 */
function ParentOffer({
  rows,
  all,
  disabled,
}: {
  rows: PhotoPlace[];
  all: Places;
  disabled: boolean;
}) {
  const pair = unrelatedPair(rows, all.places);
  if (!pair) return null;
  const { child, parent } = pair;
  return (
    <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
      <span>
        Is {child.name} in {parent.name}?
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || all.busy}
        onClick={() => all.save.mutate({ ...child, parent: parent.id })}
      >
        <FolderTreeIcon /> Put it in {parent.name}
      </Button>
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

/**
 * The two rows with their places swapped and each relation left where it was, so "In Gyeongbokgung
 * Palace by Geunjeongmun Gate" becomes "In Geunjeongmun Gate by Gyeongbokgung Palace".
 */
function swappedPlaces(rows: PhotoPlace[]): PhotoPlace[] {
  const ids = rows.map((row) => row.id).toReversed();
  return rows.map((row, index) => ({ ...row, id: ids[index] ?? row.id }));
}

interface PlaceFooterProps {
  rows: PhotoPlace[];
  all: Places;
  disabled: boolean;
  onAddSecond: () => void;
  /** Swaps the first and second places. */
  onSwap: () => void;
}

/** The places as a phrase, and adding a second place or swapping the two. */
function PlaceFooter({ rows, all, disabled, onAddSecond, onSwap }: PlaceFooterProps) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">{phraseText(rows, all)}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={rows.length === 1 ? onAddSecond : onSwap}
        >
          {rows.length === 1 ? (
            <>
              <PlusIcon /> Add a second place
            </>
          ) : (
            <>
              <ArrowUpDownIcon /> Swap places
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** The places as a quoted phrase, or what to do when none is chosen. */
function phraseText(rows: PhotoPlace[], all: Places): string {
  const phrase = placePhrase(rows, all.places, all.names);
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
