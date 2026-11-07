import { type Bucket, bucketGroup, type StatGroup, tally } from "@/lib/stat-groups";
import type { Photo } from "@/lib/photos";
import { DAYPARTS, MONTHS, SEASONS, type WhenChoice, WEEKDAYS } from "@/lib/when-filters";

/** A "when" filter's choice as a row, filtering to it. */
function whenBucket(choice: WhenChoice): Bucket {
  return {
    key: `${choice.key}:${choice.value}`,
    label: choice.label,
    detail: choice.detail,
    filter: { [choice.key]: choice.value },
  };
}

/** A group of a "when" filter's choices, in their own order. */
function whenGroup(title: string, list: Photo[], choices: WhenChoice[]): StatGroup {
  const byKey = new Map(choices.map((choice) => [`${choice.key}:${choice.value}`, choice]));
  return bucketGroup(title, list, choices.map(whenBucket), (photo, bucket) =>
    byKey.get(bucket.key)!.matches(photo),
  );
}

/** A year as a row, linking to the Timeline narrowed to it. */
function yearBucket(year: string): Bucket {
  return { key: year, label: year, timeline: { from: `${year}-01-01`, to: `${year}-12-31` } };
}

/** The year the photo was taken in. */
function yearOf(photo: Photo): string {
  return String(photo.takenAt.getFullYear());
}

/** Each year the photos were taken in, newest first. */
function yearGroup(list: Photo[]): StatGroup {
  const years = [...tally(list, yearOf).keys()].toSorted((a, b) => b.localeCompare(a));
  return bucketGroup("Year", list, years.map(yearBucket), (photo, b) => yearOf(photo) === b.key);
}

/** The Time section's groups: parts of the day, seasons, months, days of the week and years. */
export function timeGroups(list: Photo[]): StatGroup[] {
  return [
    whenGroup("Time of day", list, DAYPARTS),
    whenGroup("Season", list, SEASONS),
    whenGroup("Month", list, MONTHS),
    whenGroup("Day of the week", list, WEEKDAYS),
    yearGroup(list),
  ];
}
