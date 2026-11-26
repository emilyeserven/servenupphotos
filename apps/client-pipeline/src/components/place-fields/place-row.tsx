import { XIcon } from "lucide-react";
import { useState } from "react";
import { type Place, type PhotoPlace, RELATIONS } from "@/api/places";
import { ErrorNote } from "@/components/error-note";
import type { Places } from "@/components/place-fields/use-places";
import { PlacesJoinWord } from "@/components/place-join-fields";
import { PlaceLocalizationDialog } from "@/components/place-localization-dialog";
import type { PlaceMenu } from "@/components/place-scope";
import { Button } from "@/components/ui/button";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { inferredName } from "@/lib/inferred-places";
import { isLocalized, isUnitedStates } from "@/lib/place-hierarchy";
import { cn } from "@/lib/utils";

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
  /** The places the menu lists, and what it says when none matches. */
  menu: PlaceMenu;
}

/** How the photo relates to one place, and which place. */
export function PlaceRow({
  index,
  row,
  all,
  disabled,
  onChange,
  onRemove,
  country,
  joined,
  menu,
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
          menu={menu}
        />
        <LocalizeButton id={row.id} all={all} country={country} disabled={disabled} />
        {onRemove && <RemoveButton disabled={disabled} onRemove={onRemove} />}
      </div>
      <ErrorNote error={shown} />
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
  menu,
}: Omit<PlaceRowProps, "onRemove" | "country" | "joined"> & { onCreate: (name: string) => void }) {
  return (
    <div className="min-w-0 flex-1">
      <SingleCombobox
        id={`photo-place-${index}`}
        aria-labelledby="photo-place-label"
        options={menu.options}
        value={row.id}
        onChange={(id) => chooseOrSave(id, row, onChange, onCreate)}
        disabled={disabled || all.busy}
        placeholder={placeholder(index, all)}
        emptyText={menu.emptyText}
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
  if (all.read.isPending) return "Reading places…";
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
