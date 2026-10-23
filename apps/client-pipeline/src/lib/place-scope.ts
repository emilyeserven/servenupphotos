import type { Place } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { type LocationNames, type RegionType, winningName } from "@/lib/location-names";
import { ancestors, notParentsOf } from "@/lib/place-hierarchy";

/**
 * Which places the Photo page's place menus list: those in the photo's city, or, when it has no
 * city, those in its country.
 */
export interface PlaceScope {
  type: RegionType;
  /** The city or country, as the name that wins over its other names. */
  name: string;
}

/** The scope for a photo in city and country: the city when it has one, else the country; undefined when it has neither. */
export function placeScope(
  city: string,
  country: string,
  names: LocationNames,
): PlaceScope | undefined {
  const type: RegionType = city.trim() ? "city" : "country";
  const name = winningName(names, type, (type === "city" ? city : country).trim());
  return name ? { type, name } : undefined;
}

/** The place's city or country: its own, or else that of the nearest place it's in that has one. */
function regionOf(place: Place, places: Place[], type: RegionType): string {
  return [place, ...ancestors(places, place.id)].map((p) => p[type]?.trim()).find(Boolean) ?? "";
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Whether the place is in the scope's city or country, comparing the names that win, ignoring case. */
function inScope(place: Place, places: Place[], scope: PlaceScope, names: LocationNames): boolean {
  const region = winningName(names, scope.type, regionOf(place, places, scope.type));
  return nameKey(region) === nameKey(scope.name);
}

/** The IDs of the places in the scope's city or country. */
export function idsInScope(places: Place[], scope: PlaceScope, names: LocationNames): Set<string> {
  return new Set(places.filter((p) => inScope(p, places, scope, names)).map((p) => p.id));
}

/** The IDs of the places in the place `parent`, at any depth, not counting it. */
export function idsInside(places: Place[], parent: string): Set<string> {
  const ids = notParentsOf(places, parent);
  ids.delete(parent);
  return ids;
}

/**
 * The options for the places with the IDs, and the chosen one whatever it is, so it still shows.
 * Inferred places, which aren't saved places yet, are left out.
 */
export function optionsWith(
  options: ComboboxOption[],
  ids: Set<string>,
  chosen: string,
): ComboboxOption[] {
  return options.filter((option) => option.value === chosen || ids.has(option.value));
}
