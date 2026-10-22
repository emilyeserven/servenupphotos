import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  optimisticEntry,
  entryId,
  type Localization,
  localizationId,
  type Place,
  savePlaceMutation,
} from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import { FloatingSaveButton } from "@/components/floating-save-button";
import {
  type LocalizationDraft,
  LocalizationFields,
  useLocalizationDraft,
} from "@/components/localization-fields";
import { PlaceCityField } from "@/components/place-city-field";
import { PlaceExactLocationField } from "@/components/place-exact-location-field";
import { RegionIcon } from "@/components/region-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { gpsText, parseGps } from "@/lib/place-gps";
import { notParentsOf } from "@/lib/place-hierarchy";

interface PlaceEditorProps {
  folder: string;
  /** The place to change, or null to add one. */
  place: Place | null;
  /** Every place, to warn about a name or ID already taken. */
  places: Place[];
  /** The place's saved localization, when it has one. */
  localization?: Localization;
  onDone: () => void;
}

/** The place among places other than draft that has draft's name, ignoring case. */
function sameName(draft: Place, places: Place[]): Place | undefined {
  const name = draft.name.trim().toLowerCase();
  return places.find((place) => place.id !== draft.id && place.name.trim().toLowerCase() === name);
}

/** Why the place can't be saved as written, or undefined when it can. */
function placeProblem(draft: Place, places: Place[], isNew: boolean): string | undefined {
  if (!draft.name.trim()) return "Give it a name.";
  const named = sameName(draft, places);
  if (named) return `There's already a place named “${named.name}”.`;
  return isNew ? idTaken(draft.id, places) : undefined;
}

/** Why the GPS position can't be read, or undefined when it can or there's none. */
function gpsProblem(gps: string): string | undefined {
  if (parseGps(gps)) return undefined;
  return "Write the GPS position as latitude, longitude in degrees, such as 37.5796, 126.977.";
}

/** Why a new place can't have id, when another place has it. */
function idTaken(id: string, places: Place[]): string | undefined {
  if (!places.some((place) => place.id === id)) return undefined;
  return `A place already has the ID “${id}”, made from this name.`;
}

/** A new place's fields, before anything is typed. */
const NO_PLACE: Place = { id: "", name: "", description: "", parent: "", city: "", country: "" };

/** The fields the place form edits, as typed, with the GPS position as one line of text. */
type Draft = Required<Omit<Place, "id" | "latitude" | "longitude">> & { gps: string };

function draftOf(place: Place): Draft {
  const { name, description, parent = "", city = "", country = "", exactLocation = false } = place;
  return { name, description, parent, city, country, exactLocation, gps: gpsText(place) };
}

/**
 * The place the draft would save, with its GPS position read from the text. It's only an exact
 * location with a GPS position, and is left out of the file when it isn't.
 */
function placeOf(id: string, { gps, exactLocation, ...draft }: Draft): Place {
  const exact = exactLocation && gps.trim() !== "";
  return { id, ...draft, ...parseGps(gps), ...(exact && { exactLocation }) };
}

/** Whether any field differs from what was saved. */
function isChanged(draft: Draft, before: Draft): boolean {
  return (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== before[key]);
}

/**
 * Whether the save is of the place with this ID and hasn't failed: the list already has it, so it
 * isn't checked against itself.
 */
function isSavingPlace(save: { variables?: Place; isError: boolean }, id: string): boolean {
  return save.variables?.id === id && !save.isError;
}

/** Why the place can't be saved as written, unless it's the one being saved. */
function formProblem(
  save: { variables?: Place; isError: boolean },
  next: Place,
  gps: string,
  places: Place[],
  isNew: boolean,
): string | undefined {
  if (isSavingPlace(save, next.id)) return undefined;
  return gpsProblem(gps) ?? placeProblem(next, places, isNew);
}

/** The place form's fields as typed, the place they'd save, and saving it. */
function usePlaceForm(place: Place | null, places: Place[]) {
  const queryClient = useQueryClient();
  const initial = place ?? NO_PLACE;
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const save = useMutation({
    ...savePlaceMutation,
    ...optimisticEntry(queryClient, "places"),
  });
  const next = placeOf(place ? place.id : entryId(draft.name), draft);
  const set = (field: Exclude<keyof Draft, "exactLocation">, value: string) => {
    save.reset();
    setDraft((d) => ({ ...d, [field]: value }));
  };
  /** Sets the city, and the country too when the city's is known. */
  const setCity = (city: string, country: string | undefined) => {
    save.reset();
    setDraft((d) => ({ ...d, city, country: country || d.country }));
  };
  const setExactLocation = (exactLocation: boolean) => {
    save.reset();
    setDraft((d) => ({ ...d, exactLocation }));
  };
  const problem = formProblem(save, next, draft.gps, places, !place);
  const changed = isChanged(draft, draftOf(initial));
  return { draft, set, setCity, setExactLocation, save, next, problem, changed };
}

type PlaceForm = ReturnType<typeof usePlaceForm>;

/** Whether either save is queued or running. */
function isSaving(form: PlaceForm, localization: LocalizationDraft): boolean {
  return form.save.isPending || localization.save.isPending;
}

/** Saves the place when it's changed, and its localization when that is, each as its own commit. */
function saveBoth(form: PlaceForm, localization: LocalizationDraft) {
  const { id, name } = form.next;
  if (form.changed) form.save.mutate(form.next);
  if (localization.changed) {
    localization.saveAs({ id: localizationId("place", name, id), type: "place", name });
  }
}

/** How to fill in each of the place's fields, shown beside its title. */
const HELP = {
  name: "Such as Gyeongbokgung Palace. Its ID is made from the name when it's added, and stays.",
  description: "Optional, such as the palace's main gate.",
  parent:
    "Optional. The less specific place it's in, such as Gyeongbokgung Palace for Geunjeongmun Gate. Choosing this place on a photo adds that one as its second place.",
  city: "Optional, such as Seoul. A photo given this place takes its city and country, from the less specific of its places. Choosing a known city fills in its country.",
  country: "Optional, such as South Korea.",
  gps: "Optional. Latitude, longitude in degrees, such as 37.5796, 126.977; right-click a spot in Google Maps to copy one. Photos given this place whose EXIF has no GPS position go here on the portfolio's map.",
};

/** Adds a place, or changes one's fields and localization; its ID stays as it was made. */
export function PlaceEditor({ folder, place, places, localization, onDone }: PlaceEditorProps) {
  const form = usePlaceForm(place, places);
  const local = useLocalizationDraft(localization);
  const busy = isSaving(form, local);
  return (
    <Card>
      <PlaceEditorHeader folder={folder} place={place} id={form.next.id} />
      <CardContent>
        <form
          id="place-editor-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.problem) saveBoth(form, local);
          }}
        >
          <LabeledInput
            id="place-name"
            label="Name"
            help={HELP.name}
            value={form.draft.name}
            disabled={busy}
            onChange={(value) => form.set("name", value)}
          />
          <LabeledInput
            id="place-description"
            label="Description"
            help={HELP.description}
            value={form.draft.description}
            disabled={busy}
            onChange={(value) => form.set("description", value)}
          />
          <ParentField form={form} id={form.next.id} places={places} disabled={busy} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PlaceCityField
              value={form.draft.city}
              places={places}
              disabled={busy}
              help={HELP.city}
              onChange={(city, country) => form.setCity(city, country)}
            />
            <LabeledInput
              id="place-country"
              label="Country"
              help={HELP.country}
              value={form.draft.country}
              disabled={busy}
              onChange={(value) => form.set("country", value)}
            />
          </div>
          <LabeledInput
            id="place-gps"
            label="GPS position"
            help={HELP.gps}
            value={form.draft.gps}
            disabled={busy}
            onChange={(value) => form.set("gps", value)}
          />
          <PlaceExactLocationField
            checked={form.draft.exactLocation}
            hasGps={form.draft.gps.trim() !== ""}
            disabled={busy}
            onChange={form.setExactLocation}
          />
          <LocalizationFields draft={local} idPrefix="place-localization" disabled={busy} />
          <FormStatus form={form} localization={local} />
          <FormButtons form={form} localization={local} isNew={!place} onDone={onDone} />
          <FloatingSaveButton
            form="place-editor-form"
            disabled={!canSave(form, local)}
            busy={busy}
          />
        </form>
      </CardContent>
    </Card>
  );
}

interface ParentFieldProps {
  form: PlaceForm;
  id: string;
  places: Place[];
  disabled: boolean;
}

/**
 * The less specific place this one is in, such as the palace a gate is in. Choosing this place on
 * a photo adds the parent as its second place. Places in this one can't be its parent.
 */
function ParentField({ form, id, places, disabled }: ParentFieldProps) {
  const ruledOut = notParentsOf(places, id);
  const options = places
    .filter((place) => !ruledOut.has(place.id))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((place) => ({ value: place.id, label: place.name }));
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="place-parent-label" help={HELP.parent}>
        In
      </FieldLabel>
      <SingleCombobox
        id="place-parent"
        aria-labelledby="place-parent-label"
        options={options}
        value={form.draft.parent}
        onChange={(parent) => form.set("parent", parent)}
        disabled={disabled}
        emptyText="No other places."
      />
    </div>
  );
}

interface PlaceEditorHeaderProps {
  folder: string;
  place: Place | null;
  id: string;
}

function PlaceEditorHeader({ folder, place, id }: PlaceEditorHeaderProps) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <RegionIcon kind="place" />
        {place ? place.name : "New place"}
      </CardTitle>
      <CardDescription>
        Saves the place as <code className="break-all">{`${folder}/places/${id || "…"}.json`}</code>{" "}
        in the open photo data pull request, or opens a new one.
      </CardDescription>
    </CardHeader>
  );
}

interface FormButtonsProps {
  form: PlaceForm;
  localization: LocalizationDraft;
  isNew: boolean;
  onDone: () => void;
}

/** Save, and Cancel while changing a place or Add another once one is saved. */
function FormButtons({ form, localization, isNew, onDone }: FormButtonsProps) {
  const busy = isSaving(form, localization);
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={!canSave(form, localization)}>
        {busy && <Spinner />}
        {isNew ? "Add place" : "Save changes"}
      </Button>
      <DoneButton isNew={isNew} saved={form.save.isSuccess} onDone={onDone} />
    </div>
  );
}

/** Whether anything is changed, the place can be saved as written, and no save is running. */
function canSave(form: PlaceForm, localization: LocalizationDraft): boolean {
  const changed = form.changed || localization.changed;
  return changed && !form.problem && !isSaving(form, localization);
}

/** Close while changing a place, or Add another once a new one is saved. */
function DoneButton({
  isNew,
  saved,
  onDone,
}: {
  isNew: boolean;
  saved: boolean;
  onDone: () => void;
}) {
  if (!isNew) return <CloseButton label="Close" onDone={onDone} />;
  return saved ? <CloseButton label="Add another" onDone={onDone} /> : null;
}

function CloseButton({ label, onDone }: { label: string; onDone: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onDone}>
      {label}
    </Button>
  );
}

/** What saving did, why it failed, or why the place can't be saved yet. */
function FormStatus({ form, localization }: { form: PlaceForm; localization: LocalizationDraft }) {
  const error = formError(form, localization);
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!isSaved(form, localization)) return null;
  return (
    <p className="text-sm">
      Saved to the photo data pull request. Commit from the button at the top right to add it to
      PLACES.json.
    </p>
  );
}

/** Whether a save finished and nothing has been typed since. */
function isSaved(form: PlaceForm, localization: LocalizationDraft): boolean {
  const done = form.save.isSuccess || localization.save.isSuccess;
  return done && !isSaving(form, localization);
}

/** Why saving failed, or once a name is typed, why the place can't be saved. */
function formError(form: PlaceForm, localization: LocalizationDraft): string | undefined {
  const failed = form.save.error ?? localization.save.error;
  if (failed) return failed.message;
  return form.draft.name ? form.problem : undefined;
}

interface LabeledInputProps {
  id: string;
  label: string;
  help: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function LabeledInput({ id, label, help, value, disabled, onChange }: LabeledInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
