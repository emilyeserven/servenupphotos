import {
  type Localization,
  type LocalizationType,
  localizationId,
  type Place,
  savedPlaces,
} from "@/api/places";
import type { CombinedData } from "@/api/photos";
import { type CombinedPhoto, currentPhotos } from "@/lib/group-photos";

/** One country, city or place to localize, with how many photos list it. */
export interface LocalizationRow {
  id: string;
  type: LocalizationType;
  name: string;
  /** Where it is, such as a city's country; empty when not known. */
  detail: string;
  photos: number;
  /** Its saved localization, when there is one. */
  saved?: Localization;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The city or country a photo shows: the custom one written on the Photo page, or else its EXIF one. */
function shownField(photo: CombinedPhoto, field: "city" | "country"): string {
  const custom = field === "city" ? photo.customCity : photo.customCountry;
  return text(custom) || text(photo[field]);
}

/** How many photos list each place, by ID. */
export function placePhotoCounts(photos: CombinedPhoto[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    for (const id of new Set(savedPlaces(photo.places).map((place) => place.id))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** A row for each name, counted once per photo that lists it, keyed by ID. */
class RowSet {
  readonly rows = new Map<string, LocalizationRow>();

  /** Adds a row for name, or gives the one there a detail if it has none; returns it. */
  add(id: string, type: LocalizationType, name: string, detail = "") {
    const row = this.rows.get(id) ?? { id, type, name, detail, photos: 0 };
    row.detail ||= detail;
    this.rows.set(id, row);
    return row;
  }

  /** Counts a photo that shows the country or city name, adding its row. */
  addPhoto(type: LocalizationType, name: string, detail = "") {
    if (name) this.add(localizationId(type, name), type, name, detail).photos++;
  }
}

/** Adds a row for the country and city each photo shows, counting the photos. */
function addPhotos(set: RowSet, photos: CombinedPhoto[]) {
  for (const photo of photos) {
    const country = shownField(photo, "country");
    set.addPhoto("country", country);
    set.addPhoto("city", shownField(photo, "city"), country);
  }
}

/** Adds a row for each place, with how many photos list it. */
function addPlaces(set: RowSet, places: Place[], photos: CombinedPhoto[]) {
  const counts = placePhotoCounts(photos);
  for (const place of places) {
    const id = localizationId("place", place.name, place.id);
    set.add(id, "place", place.name, place.description).photos = counts.get(place.id) ?? 0;
  }
}

/**
 * Every country and city the photos show, and every place, each with its saved localization and
 * how many photos list it, then localizations saved for ones no longer listed, sorted by name.
 */
export function localizationRows(
  photos: CombinedPhoto[],
  places: Place[],
  localizations: Localization[],
): LocalizationRow[] {
  const set = new RowSet();
  addPhotos(set, photos);
  addPlaces(set, places, photos);
  for (const saved of localizations) set.add(saved.id, saved.type, saved.name);
  return [...set.rows.values()]
    .map((row) => ({ ...row, saved: localizations.find((l) => l.id === row.id) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The photos the combined lists have, at the pull request's head or else on the base branch; none until they're read. */
export function shownPhotos(data: CombinedData | undefined): CombinedPhoto[] {
  return (data && currentPhotos(data)?.photos) ?? [];
}
