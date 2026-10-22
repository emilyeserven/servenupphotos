import { entryId, type Place } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import type { CombinedPhoto } from "@/lib/group-photos";

/**
 * A place name written on two or more photos (their old free-text place name) that isn't a saved
 * place yet. It can be chosen like a place, which saves it as one.
 */
export interface InferredPlace {
  /** The ID it gets once it's saved. */
  id: string;
  name: string;
  /** How many photos have the name. */
  photos: number;
}

/** The value a combobox option for an inferred place has, so choosing it can save it first. */
const INFERRED_PREFIX = "inferred:";

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The photo's old free-text place name, trimmed; empty when it has none. */
function oldPlaceName(photo: CombinedPhoto): string {
  return typeof photo.placeName === "string" ? photo.placeName.trim() : "";
}

/** How many photos have each old place name, ignoring case, with the first spelling seen. */
function nameCounts(photos: CombinedPhoto[]): Map<string, { name: string; photos: number }> {
  const counts = new Map<string, { name: string; photos: number }>();
  for (const name of photos.map(oldPlaceName).filter(Boolean)) {
    const found = counts.get(nameKey(name)) ?? { name, photos: 0 };
    counts.set(nameKey(name), { ...found, photos: found.photos + 1 });
  }
  return counts;
}

/** Whether a saved place already has the name, or has it as its ID (older photos kept the ID there). */
function isSaved(name: string, places: Place[]): boolean {
  const key = nameKey(name);
  const id = entryId(name);
  return places.some((place) => nameKey(place.name) === key || [key, id].includes(place.id));
}

/** Every old place name written on two or more photos that isn't a saved place, sorted by name. */
export function inferredPlaces(photos: CombinedPhoto[], places: Place[]): InferredPlace[] {
  return [...nameCounts(photos).values()]
    .filter((found) => found.photos > 1 && !isSaved(found.name, places))
    .map((found) => ({ ...found, id: entryId(found.name) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** A combobox option for each inferred place, after the saved places. */
export function inferredOptions(inferred: InferredPlace[]): ComboboxOption[] {
  return inferred.map((place) => ({
    value: `${INFERRED_PREFIX}${place.name}`,
    label: place.name,
    detail: `Inferred from ${place.photos} photos`,
  }));
}

/** The inferred place's name, when the chosen value is an inferred place's option. */
export function inferredName(value: string): string | undefined {
  return value.startsWith(INFERRED_PREFIX) ? value.slice(INFERRED_PREFIX.length) : undefined;
}
