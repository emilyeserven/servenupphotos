import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  cacheSavedEntry,
  entryId,
  localizationId,
  type Localization,
  type Place,
  type PlacesResponse,
  placesQuery,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { placePhotoCounts, shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

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

/** Why a new place can't have id, when another place has it. */
function idTaken(id: string, places: Place[]): string | undefined {
  if (!places.some((place) => place.id === id)) return undefined;
  return `A place already has the ID “${id}”, made from this name.`;
}

/** A new place's fields, before anything is typed. */
const NO_PLACE: Place = { id: "", name: "", description: "" };

/** The place form's fields as typed, the place they'd save, and saving it. */
function usePlaceForm(place: Place | null, places: Place[]) {
  const queryClient = useQueryClient();
  const initial = place ?? NO_PLACE;
  const [draft, setDraft] = useState({ name: initial.name, description: initial.description });
  const save = useMutation({
    ...savePlaceMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "places", result),
  });
  const next: Place = { id: place ? place.id : entryId(draft.name), ...draft };
  const set = (field: keyof typeof draft, value: string) => {
    save.reset();
    setDraft((d) => ({ ...d, [field]: value }));
  };
  return { draft, set, save, next, problem: placeProblem(next, places, !place) };
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
          <FormStatus form={form} />
          <FormButtons form={form} isNew={!place} onDone={onDone} />
        </form>
      </CardContent>
    </Card>
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

interface PlaceListCardProps {
  read: UseQueryResult<PlacesResponse>;
  onEdit: (place: Place) => void;
}

/** Every place, with its local script and how many photos list it. */
function PlaceListCard({ read, onEdit }: PlaceListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Places</CardTitle>
        <CardDescription>
          {read.data ? `Read on ${read.data.branch}.` : "Every place file on GitHub."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={read} pendingLabel="Reading places from GitHub…">
          {(data) => <PlaceTable data={data} onEdit={onEdit} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

function PlaceTable({ data, onEdit }: { data: PlacesResponse; onEdit: (place: Place) => void }) {
  const counts = placePhotoCounts(shownPhotos(useCombinedData().data));
  const localizations = readEntries(data.localizations);
  const places = readEntries(data.places).toSorted((a, b) => a.name.localeCompare(b.name));
  if (data.places.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No places yet. Add one above, or from a photo's Place field.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
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
          {places.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              localization={localizationOf(localizations, place)}
              photos={counts.get(place.id) ?? 0}
              onEdit={() => onEdit(place)}
            />
          ))}
        </TableBody>
      </Table>
      <UnreadableFiles files={data.places} />
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

function localizationOf(localizations: Localization[], place: Place): Localization | undefined {
  const id = localizationId("place", place.name, place.id);
  return localizations.find((l) => l.id === id);
}

interface PlaceRowProps {
  place: Place;
  localization?: Localization;
  photos: number;
  onEdit: () => void;
}

function PlaceRow({ place, localization, photos, onEdit }: PlaceRowProps) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="font-medium">{place.name}</div>
        <div className="text-muted-foreground text-xs">
          <code>{place.id}</code>
          {place.description && ` · ${place.description}`}
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
