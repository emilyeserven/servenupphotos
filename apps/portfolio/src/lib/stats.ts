import { type Bucket, type StatGroup, tally, valueGroup } from "@/lib/stat-groups";
import { cameraOf, gearGroups } from "@/lib/stats-gear";
import { timeGroups } from "@/lib/stats-time";
import { type Photo, photos } from "@/lib/photos";

/** A section of the Stats page, such as Gear, with its groups. */
export interface StatSection {
  id: "gear" | "places" | "time";
  title: string;
  description: string;
  groups: StatGroup[];
}

/** The headline numbers at the top of the Stats page. */
export interface StatTotals {
  photos: number;
  cameras: number;
  countries: number;
  cities: number;
  years: number;
}

/** Each city's country, by the city's English name, as the photos have them. */
function cityCountries(list: Photo[]): Map<string, string> {
  return new Map(list.flatMap((p) => (p.city && p.country ? [[p.city, p.country]] : [])));
}

/** A country as a row, filtering to it. */
function countryBucket(country: string): Bucket {
  return { key: country, label: country, filter: { country } };
}

/** The Places section's groups: countries, and cities with their country on hover. */
function placeGroups(list: Photo[]): StatGroup[] {
  const countries = cityCountries(list);
  return [
    valueGroup("Countries", list, (photo) => photo.country, countryBucket),
    valueGroup(
      "Cities",
      list,
      (photo) => photo.city,
      (city) => ({
        key: city,
        label: city,
        hint: countries.get(city),
        filter: { city },
      }),
    ),
  ];
}

/**
 * Every section of the Stats page, counting the photos given: the ones the filters leave. `all`
 * is every portfolio photo, which the focal length ranges are worked out from, as the Grid's are.
 */
export function statSections(list: Photo[], all: Photo[] = photos): StatSection[] {
  return [
    {
      id: "gear",
      title: "Gear",
      description: "What the photos were taken with.",
      groups: gearGroups(list, all),
    },
    {
      id: "places",
      title: "Places",
      description: "Where the photos were taken.",
      groups: placeGroups(list),
    },
    {
      id: "time",
      title: "Time",
      description: "When the photos were taken, by the clock and calendar where they were.",
      groups: timeGroups(list),
    },
  ];
}

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
