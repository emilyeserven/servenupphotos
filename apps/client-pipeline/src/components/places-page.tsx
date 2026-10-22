import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  cacheSavedEntry,
  entryId,
  type Place,
  placesQuery,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PlaceCityField } from "@/components/place-city-field";
import { PlaceListCard } from "@/components/place-list-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { Spinner } from "@/components/ui/spinner";
import { gpsText, parseGps } from "@/lib/place-gps";
import { notParentsOf } from "@/lib/place-hierarchy";

/** The Places page: a form to add or change a place, then every place on GitHub. */
export function PlacesPage() {
  return (
    <Page
      title="Places"
      description="Where photos were taken, more exactly than their city, such as Gyeongbokgung Palace. Each place is its own JSON file, combined into PLACES.json, and photos list them by ID with how they relate to them."
    >
      <GitHubGate>{(folder) => <PlaceCards folder={folder} />}</GitHubGate>
    </Page>
  );
}

function PlaceCards({ folder }: { folder: string }) {
  const read = useQuery(placesQuery);
  // The place being changed; null for a new one. Bumped keys start the form afresh.
  const [editing, setEditing] = useState<{ place: Place | null; key: number }>({
    place: null,
    key: 0,
  });
  const edit = (place: Place | null) => setEditing((e) => ({ place, key: e.key + 1 }));
  const places = readEntries(read.data?.places);
  return (
    <>
      <PlaceFormCard
        key={editing.key}
        folder={folder}
        place={editing.place}
        places={places}
        onDone={() => edit(null)}
      />
      <PlaceListCard read={read} onEdit={edit} />
    </>
  );
}

interface PlaceFormCardProps {
  folder: string;
  /** The place to change, or null to add one. */
  place: Place | null;
  /** Every place, to warn about a name or ID already taken. */
  places: Place[];
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
  const { name, description, parent = "", city = "", country = "" } = place;
  return { name, description, parent, city, country, gps: gpsText(place) };
}

/** The place the draft would save, with its GPS position read from the text. */
function placeOf(id: string, { gps, ...draft }: Draft): Place {
  return { id, ...draft, ...parseGps(gps) };
}

/** The place form's fields as typed, the place they'd save, and saving it. */
function usePlaceForm(place: Place | null, places: Place[]) {
  const queryClient = useQueryClient();
  const initial = place ?? NO_PLACE;
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const save = useMutation({
    ...savePlaceMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "places", result),
  });
  const next = placeOf(place ? place.id : entryId(draft.name), draft);
  const set = (field: keyof Draft, value: string) => {
    save.reset();
    setDraft((d) => ({ ...d, [field]: value }));
  };
  /** Sets the city, and the country too when the city's is known. */
  const setCity = (city: string, country: string | undefined) => {
    save.reset();
    setDraft((d) => ({ ...d, city, country: country || d.country }));
  };
  const problem = gpsProblem(draft.gps) ?? placeProblem(next, places, !place);
  return { draft, set, setCity, save, next, problem };
}

type PlaceForm = ReturnType<typeof usePlaceForm>;

/** Adds a place, or changes one's name and description; its ID stays as it was made. */
function PlaceFormCard({ folder, place, places, onDone }: PlaceFormCardProps) {
  const form = usePlaceForm(place, places);
  return (
    <Card>
      <PlaceFormHeader folder={folder} place={place} id={form.next.id} />
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.problem) form.save.mutate(form.next);
          }}
        >
          <LabeledInput
            id="place-name"
            label="Name"
            placeholder="Such as Gyeongbokgung Palace"
            value={form.draft.name}
            disabled={form.save.isPending}
            onChange={(value) => form.set("name", value)}
          />
          <LabeledInput
            id="place-description"
            label="Description"
            placeholder="Optional, such as the palace's main gate"
            value={form.draft.description}
            disabled={form.save.isPending}
            onChange={(value) => form.set("description", value)}
          />
          <ParentField form={form} id={form.next.id} places={places} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PlaceCityField
              value={form.draft.city}
              places={places}
              disabled={form.save.isPending}
              onChange={(city, country) => form.setCity(city, country)}
            />
            <LabeledInput
              id="place-country"
              label="Country"
              placeholder="Optional, such as South Korea"
              value={form.draft.country}
              disabled={form.save.isPending}
              onChange={(value) => form.set("country", value)}
            />
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            A photo given this place takes its city and country, from the less specific of its
            places.
          </p>
          <LabeledInput
            id="place-gps"
            label="GPS position"
            placeholder="Optional, latitude, longitude, such as 37.5796, 126.977"
            value={form.draft.gps}
            disabled={form.save.isPending}
            onChange={(value) => form.set("gps", value)}
          />
          <p className="text-muted-foreground -mt-2 text-xs">
            Used on the portfolio's map for photos given this place whose EXIF has no GPS position.
            Right-click a spot in Google Maps to copy one.
          </p>
          <FormStatus form={form} />
          <FormButtons form={form} isNew={!place} onDone={onDone} />
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * The less specific place this one is in, such as the palace a gate is in. Choosing this place on
 * a photo adds the parent as its second place. Places in this one can't be its parent.
 */
function ParentField({ form, id, places }: { form: PlaceForm; id: string; places: Place[] }) {
  const ruledOut = notParentsOf(places, id);
  const options = places
    .filter((place) => !ruledOut.has(place.id))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((place) => ({ value: place.id, label: place.name }));
  return (
    <div className="flex flex-col gap-2">
      <span id="place-parent-label" className="text-sm font-medium">
        In
      </span>
      <SingleCombobox
        id="place-parent"
        aria-labelledby="place-parent-label"
        options={options}
        value={form.draft.parent}
        onChange={(parent) => form.set("parent", parent)}
        disabled={form.save.isPending}
        placeholder="Optional, the place it's in, such as Gyeongbokgung Palace"
        emptyText="No other places."
      />
    </div>
  );
}

function PlaceFormHeader({
  folder,
  place,
  id,
}: {
  folder: string;
  place: Place | null;
  id: string;
}) {
  return (
    <CardHeader>
      <CardTitle>{place ? `Change ${place.name}` : "New place"}</CardTitle>
      <CardDescription>
        Saves the place as <code className="break-all">{`${folder}/places/${id || "…"}.json`}</code>{" "}
        in the open photo data pull request, or opens a new one. Its local script and how it's said
        go on the Localizations page.
      </CardDescription>
    </CardHeader>
  );
}

/** Save, and Cancel while changing a place or Add another once it's saved. */
function FormButtons({
  form,
  isNew,
  onDone,
}: {
  form: PlaceForm;
  isNew: boolean;
  onDone: () => void;
}) {
  const { save } = form;
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={Boolean(form.problem) || save.isPending}>
        {save.isPending && <Spinner />}
        {isNew ? "Add place" : "Save changes"}
      </Button>
      <DoneButton isNew={isNew} saved={save.isSuccess} onDone={onDone} />
    </div>
  );
}

/** Cancel while changing a place, or Add another once one is saved. */
function DoneButton({
  isNew,
  saved,
  onDone,
}: {
  isNew: boolean;
  saved: boolean;
  onDone: () => void;
}) {
  if (isNew && !saved) return null;
  return (
    <Button type="button" variant="outline" onClick={onDone}>
      {saved ? "Add another" : "Cancel"}
    </Button>
  );
}

/** What saving did, why it failed, or why the place can't be saved yet. */
function FormStatus({ form }: { form: PlaceForm }) {
  if (form.save.isSuccess) return <p className="text-sm">{savedText(form.save.data.changed)}</p>;
  const error = formError(form);
  return error ? <p className="text-destructive text-sm">{error}</p> : null;
}

/** Why saving failed, or once a name is typed, why the place can't be saved. */
function formError({ save, problem, draft }: PlaceForm): string | undefined {
  if (save.error) return save.error.message;
  return draft.name ? problem : undefined;
}

function savedText(changed: boolean): string {
  return changed
    ? "Saved to the photo data pull request. Commit from the button at the top right to add it to PLACES.json."
    : "Nothing changed, so nothing was saved.";
}

interface LabeledInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function LabeledInput({ id, label, placeholder, value, disabled, onChange }: LabeledInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
