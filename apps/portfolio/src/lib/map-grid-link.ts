import type { LngLatBounds } from "maplibre-gl";
import { type PlacedPhoto, placedPhotos } from "@/lib/map-photos";
import {
  filterPhotos,
  LOCATION_KEYS,
  type LocationKey,
  locationFilters,
  matchesFilters,
  type PhotoFilters,
  withoutFilters,
} from "@/lib/photo-filters";

/** A location as the Places filter's values name it, such as "city:Seoul". */
type LocationValue = `${LocationKey}:${string}`;

/** Every location the photo is in: its country, state and city, and each of its places. */
function locationsOf(photo: PlacedPhoto): LocationValue[] {
  const fields = (["country", "state", "city"] as const).flatMap((key) => {
    const value = photo[key];
    return value ? [`${key}:${value}` as const] : [];
  });
  return [...fields, ...photo.placeIds.map((id) => `place:${id}` as const)];
}

/** A location and the photos on the map it would show. */
interface Candidate {
  value: LocationValue;
  matches: PlacedPhoto[];
}

/** The photos the location shows, out of the photos the other filters leave. */
function candidateOf(value: LocationValue, shown: PlacedPhoto[]): Candidate {
  return { value, matches: filterPhotos(shown, locationFilters([value])) };
}

/**
 * The fewest locations, biggest first, that between them show just the photos in view, or null
 * when no set of locations does, such as when a city is only partly in view.
 */
function locationsCovering(inView: PlacedPhoto[], shown: PlacedPhoto[]): LocationValue[] | null {
  const ids = new Set(inView.map((photo) => photo.id));
  const fitting = [...new Set(inView.flatMap(locationsOf))]
    .map((value) => candidateOf(value, shown))
    .filter((candidate) => candidate.matches.every((photo) => ids.has(photo.id)))
    .toSorted((a, b) => b.matches.length - a.matches.length);
  const covered = new Set<number>();
  const chosen = fitting.filter((candidate) => addsPhotos(candidate, covered));
  return covered.size === ids.size ? chosen.map((candidate) => candidate.value) : null;
}

/** Whether the location shows a photo not covered yet, adding its photos to `covered` if so. */
function addsPhotos(candidate: Candidate, covered: Set<number>): boolean {
  const added = candidate.matches.filter((photo) => !covered.has(photo.id));
  for (const photo of added) covered.add(photo.id);
  return added.length > 0;
}

/** Whether a photo has resized versions, which is all the Grid shows. */
function hasImage(photo: PlacedPhoto): boolean {
  return photo.image !== null;
}

/** The photos with resized versions inside the bounds. */
function photosInView(drawn: PlacedPhoto[], bounds: LngLatBounds): PlacedPhoto[] {
  return drawn.filter(
    (photo) => hasImage(photo) && bounds.contains([photo.longitude, photo.latitude]),
  );
}

/**
 * The filters showing just the photos in view: the album, tag and genre filters alone when they
 * show nothing more, else with the places that cover them, or else the photos one by one.
 */
function filtersShowing(inView: PlacedPhoto[], groups: PhotoFilters): PhotoFilters {
  const shown = placedPhotos.filter((photo) => hasImage(photo) && matchesFilters(photo, groups));
  if (shown.length === inView.length) return groups;
  const locations = locationsCovering(inView, shown);
  return locations
    ? { ...groups, ...locationFilters(locations) }
    : { ids: inView.map((photo) => photo.id) };
}

/**
 * The Grid's filters for showing the photos the map has in view, or null when none are in view.
 * They're the map's album, tag and genre filters with the places that cover just those photos, when
 * there are some, and otherwise the photos chosen one by one.
 */
export function gridFiltersFor(
  drawn: PlacedPhoto[],
  bounds: LngLatBounds | null,
  filters: PhotoFilters,
): PhotoFilters | null {
  const inView = bounds ? photosInView(drawn, bounds) : [];
  if (inView.length === 0) return null;
  return filtersShowing(inView, withoutFilters(filters, [...LOCATION_KEYS, "ids"]));
}
