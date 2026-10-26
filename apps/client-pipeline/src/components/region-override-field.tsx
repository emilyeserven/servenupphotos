import { useQuery } from "@tanstack/react-query";
import { placesQuery, readEntries } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { locationNames } from "@/lib/location-names";
import {
  type CityRow,
  type CountryRow,
  type StateRow,
  cityRows,
  countryRows,
  stateRows,
} from "@/lib/place-cities";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The count with its noun, such as "1 place" or "3 places". */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** How a city or country is known: from places, or else inferred from photos. */
function usedBy(row: { places: number; photos: number }): string {
  return row.places > 0
    ? counted(row.places, "place")
    : `Inferred from ${counted(row.photos, "photo")}`;
}

function cityOption(city: CityRow): ComboboxOption {
  return { value: city.name, label: city.name, detail: [city.country, usedBy(city)].join(" · ") };
}

function countryOption(country: CountryRow): ComboboxOption {
  return { value: country.name, label: country.name, detail: usedBy(country) };
}

function stateOption(state: StateRow): ComboboxOption {
  return {
    value: state.name,
    label: state.name,
    detail: [state.country, usedBy(state)].filter(Boolean).join(" · "),
  };
}

/** The options, plus the written value when it's new, so it doesn't show as unknown. */
function withWritten(options: ComboboxOption[], value: string): ComboboxOption[] {
  const isNew = value.trim() && !options.some((option) => option.value === value);
  return isNew ? [...options, { value, label: value }] : options;
}

/** Every city and country the places are in or the photos show, read the way the Places page reads them. */
function useRegions() {
  const read = useQuery(placesQuery).data;
  const places = readEntries(read?.places);
  const names = locationNames(readEntries(read?.localizations));
  const photos = shownPhotos(useCombinedData().data);
  return {
    cities: cityRows(photos, places, names),
    states: stateRows(photos, places, names),
    countries: countryRows(photos, places, names),
  };
}

interface RegionOverrideFieldProps {
  id: string;
  kind: "city" | "state" | "country";
  value: string;
  placeholder: string;
  disabled: boolean;
  /** Called with the chosen name, and for a city or state, its country when one is known. */
  onChange: (name: string, country?: string) => void;
}

/** The noun for the empty message, by kind. */
const EMPTY_NOUN = {
  city: "cities",
  state: "states, provinces or prefectures",
  country: "countries",
};

/** The options for the kind: cities, states or countries. */
function regionOptions(
  kind: "city" | "state" | "country",
  rows: { cities: CityRow[]; states: StateRow[]; countries: CountryRow[] },
): ComboboxOption[] {
  if (kind === "city") return rows.cities.map(cityOption);
  if (kind === "state") return rows.states.map(stateOption);
  return rows.countries.map(countryOption);
}

/** The rows whose countries choosing one fills in, by kind; a country has none. */
function rowsWithCountry(
  kind: "city" | "state" | "country",
  rows: { cities: CityRow[]; states: StateRow[] },
): { name: string; country: string }[] {
  if (kind === "city") return rows.cities;
  return kind === "state" ? rows.states : [];
}

/** The country of the city or state named name, when it's known. */
function knownCountry(rows: { name: string; country: string }[], name: string) {
  return rows.find((row) => row.name === name)?.country || undefined;
}

/**
 * A photo's or place's custom city, state or country, chosen from the ones places are in or photos show (marked
 * inferred when only photos have it), or typed. On a photo, clearing it goes back to the EXIF one.
 */
export function RegionOverrideField({
  id,
  kind,
  value,
  placeholder,
  disabled,
  onChange,
}: RegionOverrideFieldProps) {
  const { cities, states, countries } = useRegions();
  const options = regionOptions(kind, { cities, states, countries });
  const choose = (name: string) =>
    onChange(name, knownCountry(rowsWithCountry(kind, { cities, states }), name));
  return (
    <SingleCombobox
      id={id}
      options={withWritten(options, value)}
      value={value}
      onChange={choose}
      disabled={disabled}
      placeholder={placeholder}
      emptyText={`No ${EMPTY_NOUN[kind]} yet. Type one to use it.`}
      createLabel={(text) => `Use “${text}”`}
      onCreate={choose}
    />
  );
}
