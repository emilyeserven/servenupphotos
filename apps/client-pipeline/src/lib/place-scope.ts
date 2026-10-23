import type { Place } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { type LocationNames, type RegionType, winningName } from "@/lib/location-names";
import { ancestors } from "@/lib/place-hierarchy";

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

/**
 * The options for the places in the scope, and the chosen one whatever its scope, so it still shows.
 * Inferred places, which have no city or country, are left out.
 */
export function scopedOptions(
  options: ComboboxOption[],
  places: Place[],
  scope: PlaceScope,
  names: LocationNames,
  chosen: string,
): ComboboxOption[] {
  const ids = new Set(places.filter((p) => inScope(p, places, scope, names)).map((p) => p.id));
  return options.filter((option) => option.value === chosen || ids.has(option.value));
}
