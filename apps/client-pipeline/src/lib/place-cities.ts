import type { Place } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";
import { type LocationNames, NO_LOCATION_NAMES, winningName } from "@/lib/location-names";
import { shownField } from "@/lib/place-seeds";
import { placeChain } from "@/lib/place-tree";

/** A city that photos show or places are in, with its country and how many photos and places have it. */
export interface CityRow {
  name: string;
  /** Its state, from the first place or photo that has one; empty when not known. */
  state: string;
  /** Its country, from the first place or photo that has one; empty when not known. */
  country: string;
  photos: number;
  places: number;
}

/** A state, province or prefecture photos show or places are in, with its country and counts. */
export interface StateRow {
  name: string;
  /** Its country, from the first place or photo that has one; empty when not known. */
  country: string;
  photos: number;
  places: number;
}

/** A country that photos show or places are in, with how many cities, photos and places have it. */
export interface CountryRow {
  name: string;
  cities: number;
  photos: number;
  places: number;
}

/** A city or country's name, for matching it ignoring case and spaces at the ends. */
export function regionKey(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Counts named things by key, keeping the first spelling and the first country seen. */
class Tally<T extends { name: string }> {
  readonly rows = new Map<string, T>();

  constructor(private readonly empty: (name: string) => T) {}

  /** The row for name, made when there's none yet; undefined when name is empty. */
  row(name: string | undefined): T | undefined {
    const key = regionKey(name);
    if (!key) return undefined;
    const found = this.rows.get(key) ?? this.empty(regionName(name));
    this.rows.set(key, found);
    return found;
  }

  /** Every row, sorted by name. */
  sorted(): T[] {
    return [...this.rows.values()].toSorted((a, b) => a.name.localeCompare(b.name));
  }
}

/** Counts one photo or place in the city, giving the city a state and country if it had none. */
function countCity(tally: Tally<CityRow>, r: RegionValues, field: "photos" | "places") {
  const row = tally.row(r.city);
  if (!row) return;
  row[field]++;
  row.state ||= regionName(r.state);
  row.country ||= regionName(r.country);
}

/** Counts one photo or place in the state, giving the state a country if it had none. */
function countState(tally: Tally<StateRow>, r: RegionValues, field: "photos" | "places") {
  const row = tally.row(r.state);
  if (!row) return;
  row[field]++;
  row.country ||= regionName(r.country);
}

/** The name trimmed, or empty when there's none. */
function regionName(name: string | undefined): string {
  return (name ?? "").trim();
}

/** A place's or photo's city, state and country, each written as the name that wins over it. */
interface RegionValues {
  city: string;
  state: string;
  country: string;
}

/** A photo's or place's city, state and country, each written as the name that wins over it. */
function regionOf(
  names: LocationNames,
  city: string | undefined,
  state: string | undefined,
  country: string | undefined,
): RegionValues {
  return {
    city: winningName(names, "city", city),
    state: winningName(names, "state", state),
    country: winningName(names, "country", country),
  };
}

/** Each place's and photo's city, state and country, written as the names that win, and what it is. */
function regionsOf(photos: CombinedPhoto[], places: Place[], names: LocationNames) {
  return [
    ...places.map((p) => ({
      ...regionOf(names, p.city, p.state, p.country),
      field: "places" as const,
    })),
    ...photos.map((p) => ({
      ...regionOf(names, shownField(p, "city"), shownField(p, "state"), shownField(p, "country")),
      field: "photos" as const,
    })),
  ];
}

/**
 * Every city the photos show or the places are in, sorted by name. A city that's another name of
 * one (see `locationNames`) is counted as the one that wins.
 */
export function cityRows(
  photos: CombinedPhoto[],
  places: Place[],
  names: LocationNames = NO_LOCATION_NAMES,
): CityRow[] {
  const tally = new Tally<CityRow>((name) => ({
    name,
    state: "",
    country: "",
    photos: 0,
    places: 0,
  }));
  for (const r of regionsOf(photos, places, names)) countCity(tally, r, r.field);
  return tally.sorted();
}

/**
 * Every state, province or prefecture the photos show or the places are in, sorted by name, as
 * `cityRows`.
 */
export function stateRows(
  photos: CombinedPhoto[],
  places: Place[],
  names: LocationNames = NO_LOCATION_NAMES,
): StateRow[] {
  const tally = new Tally<StateRow>((name) => ({ name, country: "", photos: 0, places: 0 }));
  for (const r of regionsOf(photos, places, names)) countState(tally, r, r.field);
  return tally.sorted();
}

/** Every country the photos show, the places are in, or a city is in, sorted by name, as `cityRows`. */
export function countryRows(
  photos: CombinedPhoto[],
  places: Place[],
  names: LocationNames = NO_LOCATION_NAMES,
): CountryRow[] {
  const tally = new Tally<CountryRow>((name) => ({ name, cities: 0, photos: 0, places: 0 }));
  for (const r of regionsOf(photos, places, names)) countIn(tally.row(r.country), r.field);
  for (const city of cityRows(photos, places, names)) countIn(tally.row(city.country), "cities");
  return tally.sorted();
}

function countIn(row: CountryRow | undefined, field: "cities" | "photos" | "places") {
  if (row) row[field]++;
}

/**
 * The city a place is in: its own, or else the nearest place above it that has one. Empty when none
 * of them has a city.
 */
export function cityOfPlace(place: Place, places: Place[]): string {
  const cities = placeChain(place, places).chain.map((p) => (p.city ?? "").trim());
  return cities.find(Boolean) ?? "";
}

/**
 * The state a place is in: its own, or else the nearest place above it that has one. Empty when
 * none of them has a state.
 */
export function stateOfPlace(place: Place, places: Place[]): string {
  const states = placeChain(place, places).chain.map((p) => (p.state ?? "").trim());
  return states.find(Boolean) ?? "";
}
