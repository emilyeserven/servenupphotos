import { NO_STATE } from "@portfolio/lib/photo-filters";
import {
  type Bucket,
  type GroupDef,
  type KeyOf,
  type StatGroup,
  tally,
  valueGroup,
} from "@portfolio/lib/stat-groups";
import { cameraOf, GEAR_GROUPS } from "@portfolio/lib/stats-gear";
import { TIME_GROUPS } from "@portfolio/lib/stats-time";
import type { Photo } from "@portfolio/lib/photos";

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
  regions: number;
  cities: number;
  years: number;
}

/** A country as a row, filtering to it. */
function countryBucket(country: string): Bucket {
  return { key: country, label: country, filter: { country } };
}

/** Each city's or region's country, by its English name, as the photos have them. */
function countriesOf(list: Photo[], keyOf: KeyOf): Map<string, string> {
  return new Map(
    list.flatMap((photo) => {
      const key = keyOf(photo);
      return key && photo.country ? [[key, photo.country]] : [];
    }),
  );
}

/** The photo's state, province or prefecture. */
function stateOf(photo: Photo): string | null {
  return photo.state;
}

/**
 * Each region (state, province or prefecture) with its country on hover, and last a "No region"
 * row for the photos without one, which narrows the cities to those photos too.
 */
function regionGroup(list: Photo[]): StatGroup {
  const countries = countriesOf(list, stateOf);
  const group = valueGroup("Regions", list, stateOf, (state) => ({
    key: state,
    label: state,
    hint: countries.get(state),
    filter: { state },
  }));
  if (group.missing === 0) return group;
  const none = { label: "No region", count: group.missing, filter: { state: NO_STATE } };
  return { ...group, rows: [...group.rows, none], missing: 0 };
}

/**
 * The Places section's groups: countries narrowing the regions, regions narrowing the cities, and
 * cities, each region and city with its country on hover.
 */
const PLACE_GROUPS: GroupDef[] = [
  {
    id: "countries",
    narrows: "regions",
    build: (list) => valueGroup("Countries", list, (photo) => photo.country, countryBucket),
  },
  { id: "regions", narrows: "cities", build: regionGroup },
  {
    id: "cities",
    build: (list) => {
      const countries = countriesOf(list, (photo) => photo.city);
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
    regions: tally(list, stateOf).size,
    cities: tally(list, (photo) => photo.city).size,
    years: tally(list, (photo) => String(photo.takenAt.getFullYear())).size,
  };
}
