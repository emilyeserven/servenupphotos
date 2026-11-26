import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cacheSavedEntry,
  entryId,
  type Localization,
  localizationId,
  type Place,
  placesQuery,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { type ComboboxOption } from "@/components/ui/combobox";
import { inferredOptions, inferredPlaces } from "@/lib/inferred-places";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The places as a map from ID to name, for showing them. */
function placeNames(places: Place[]): Map<string, string> {
  return new Map(places.map((place) => [place.id, place.name || place.id]));
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
export function usePlaces() {
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

/** Every place and its localizations, as options for a combobox, and a way to add one. */
export type Places = ReturnType<typeof usePlaces>;
