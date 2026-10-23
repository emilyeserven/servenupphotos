import { useQuery } from "@tanstack/react-query";
import { placesQuery, readEntries } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { locationNames } from "@/lib/location-names";
import { type CityRow, type CountryRow, cityRows, countryRows } from "@/lib/place-cities";
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
  return { cities: cityRows(photos, places, names), countries: countryRows(photos, places, names) };
}

interface RegionOverrideFieldProps {
  id: string;
  kind: "city" | "country";
  value: string;
  placeholder: string;
  disabled: boolean;
  /** Called with the chosen name, and for a city, its country when one is known. */
  onChange: (name: string, country?: string) => void;
}

/**
 * A photo's custom city or country, chosen from the ones places are in or photos show (marked
 * inferred when only photos have it), or typed. Clearing it goes back to the EXIF one.
 */
export function RegionOverrideField({
  id,
  kind,
  value,
  placeholder,
  disabled,
  onChange,
}: RegionOverrideFieldProps) {
  const { cities, countries } = useRegions();
  const options = kind === "city" ? cities.map(cityOption) : countries.map(countryOption);
  const choose = (name: string) => onChange(name, cities.find((c) => c.name === name)?.country);
  return (
    <SingleCombobox
      id={id}
      options={withWritten(options, value)}
      value={value}
      onChange={choose}
      disabled={disabled}
      placeholder={placeholder}
      emptyText={`No ${kind === "city" ? "cities" : "countries"} yet. Type one to use it.`}
      createLabel={(text) => `Use “${text}”`}
      onCreate={choose}
    />
  );
}
