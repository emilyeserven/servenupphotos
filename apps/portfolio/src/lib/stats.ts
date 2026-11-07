import { type Bucket, type GroupDef, tally, valueGroup } from "@/lib/stat-groups";
import { cameraOf, GEAR_GROUPS } from "@/lib/stats-gear";
import { TIME_GROUPS } from "@/lib/stats-time";
import type { Photo } from "@/lib/photos";

/** A section of the Stats page, such as Gear, with how to make its groups. */
export interface StatSection {
  id: "gear" | "places" | "time";
  title: string;
  description: string;
  groups: GroupDef[];
}

/** The headline numbers at the top of the Stats page. */
export interface StatTotals {
  photos: number;
  cameras: number;
  countries: number;
  cities: number;
  years: number;
}

/** A country as a row, filtering to it. */
function countryBucket(country: string): Bucket {
  return { key: country, label: country, filter: { country } };
}

/** Each city's country, by the city's English name, as the photos have them. */
function cityCountries(list: Photo[]): Map<string, string> {
  return new Map(list.flatMap((p) => (p.city && p.country ? [[p.city, p.country]] : [])));
}

/** The Places section's groups: countries (narrowing the cities), and cities with their country on hover. */
const PLACE_GROUPS: GroupDef[] = [
  {
    id: "countries",
    narrows: "cities",
    build: (list) => valueGroup("Countries", list, (photo) => photo.country, countryBucket),
  },
  {
    id: "cities",
    build: (list) => {
      const countries = cityCountries(list);
      return valueGroup(
        "Cities",
        list,
        (photo) => photo.city,
        (city) => ({
          key: city,
          label: city,
          hint: countries.get(city),
          filter: { city },
        }),
      );
    },
  },
];

/** The sections of the Stats page, each with its groups. */
export const STAT_SECTIONS: StatSection[] = [
  {
    id: "gear",
    title: "Gear",
    description: "What the photos were taken with.",
    groups: GEAR_GROUPS,
  },
  {
    id: "places",
    title: "Places",
    description: "Where the photos were taken.",
    groups: PLACE_GROUPS,
  },
  {
    id: "time",
    title: "Time",
    description: "When the photos were taken, by the clock and calendar where they were.",
    groups: TIME_GROUPS,
  },
];

/** The headline numbers for the top of the Stats page. */
export function statTotals(list: Photo[]): StatTotals {
  return {
    photos: list.length,
    cameras: tally(list, cameraOf).size,
    countries: tally(list, (photo) => photo.country).size,
    cities: tally(list, (photo) => photo.city).size,
    years: tally(list, (photo) => String(photo.takenAt.getFullYear())).size,
  };
}
