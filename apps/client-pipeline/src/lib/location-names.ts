import type { Localization, Place } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";

/** A country or city, which can have other names. */
export type RegionType = "country" | "state" | "city";

/**
 * The names that win over other ways of writing a country or city, from the localizations' other
 * names: by type, then by the other name (trimmed and lowercased), the name that wins.
 */
export type LocationNames = Record<RegionType, ReadonlyMap<string, string>>;

/** No other names, so every name is its own. */
export const NO_LOCATION_NAMES: LocationNames = {
  country: new Map(),
  state: new Map(),
  city: new Map(),
};

/** A name as other names are matched: trimmed, ignoring case. */
function nameKey(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Adds each of l's other names, with l's name as the one that wins. */
function addOtherNames(names: Map<string, string>, l: Localization) {
  for (const other of l.otherNames ?? []) names.set(nameKey(other), l.name);
}

/** The other names the country and city localizations list. */
export function locationNames(localizations: Localization[]): LocationNames {
  const names = {
    country: new Map<string, string>(),
    state: new Map<string, string>(),
    city: new Map<string, string>(),
  };
  for (const l of localizations) {
    if (l.type !== "place") addOtherNames(names[l.type], l);
  }
  return names;
}

/** The name, or the name that wins over it when it's another name of a country or city. */
export function winningName(names: LocationNames, type: RegionType, name: string | undefined) {
  return names[type].get(nameKey(name)) ?? name ?? "";
}

/** Whether value is another name of winner, so Update Data's Location names rewrites it. */
function isOtherName(names: LocationNames, type: RegionType, winner: string, value: unknown) {
  return (
    typeof value === "string" && value !== winner && winningName(names, type, value) === winner
  );
}

const CUSTOM_FIELD = {
  country: "customCountry",
  state: "customState",
  city: "customCity",
} as const;

/** How many photos and places still write another name of winner, until Update Data rewrites them. */
export function unrenamedCounts(
  photos: CombinedPhoto[],
  places: Place[],
  names: LocationNames,
  type: RegionType,
  winner: string,
) {
  const other = (value: unknown) => isOtherName(names, type, winner, value);
  return {
    photos: photos.filter((p) => other(p[type]) || other(p[CUSTOM_FIELD[type]])).length,
    places: places.filter((p) => other(p[type])).length,
  };
}
