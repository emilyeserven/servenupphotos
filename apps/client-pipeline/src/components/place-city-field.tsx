import type { Place } from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { type CityRow, cityRows, regionKey } from "@/lib/place-cities";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The count with its noun, such as "1 place" or "3 places". */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** What an option says under the city: its country, and how many places are in it or photos show it. */
function cityDetail(city: CityRow): string {
  const used =
    city.places > 0
      ? counted(city.places, "place")
      : `Inferred from ${counted(city.photos, "photo")}`;
  return [city.country, used].filter(Boolean).join(" · ");
}

/** An option for each city, plus the typed one when it's new, so it doesn't show as unknown. */
function cityOptions(cities: CityRow[], value: string): ComboboxOption[] {
  const options = cities.map((city) => ({
    value: city.name,
    label: city.name,
    detail: cityDetail(city),
  }));
  const isNew = value.trim() && !cities.some((city) => city.name === value);
  return isNew ? [...options, { value, label: value }] : options;
}

interface PlaceCityFieldProps {
  value: string;
  places: Place[];
  disabled: boolean;
  /** How to fill the field in, shown beside its title. */
  help: string;
  /** Starts the field's IDs, so two on a page don't clash; "place-city" when not given. */
  id?: string;
  /** Called with the chosen city, and its country when one is known for it. */
  onChange: (city: string, country: string | undefined) => void;
}

/**
 * The place's city, chosen from the cities places are already in or the ones photos show (inferred),
 * or typed. Choosing a city whose country is known fills in the country too.
 */
export function PlaceCityField({
  id = "place-city",
  value,
  places,
  disabled,
  help,
  onChange,
}: PlaceCityFieldProps) {
  const cities = cityRows(shownPhotos(useCombinedData().data), places);
  const choose = (city: string) => {
    const found = cities.find((c) => regionKey(c.name) === regionKey(city));
    onChange(found ? found.name : city, found?.country);
  };
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={`${id}-label`} help={help}>
        City
      </FieldLabel>
      <SingleCombobox
        id={id}
        aria-labelledby={`${id}-label`}
        options={cityOptions(cities, value)}
        value={value}
        onChange={choose}
        disabled={disabled}
        emptyText="No cities yet. Type one to use it."
        createLabel={(text) => `Use “${text}” as the city`}
        onCreate={choose}
      />
    </div>
  );
}
