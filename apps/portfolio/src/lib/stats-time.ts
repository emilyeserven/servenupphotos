import {
  type Bucket,
  bucketGroup,
  type GroupDef,
  type StatGroup,
  tally,
} from "@portfolio/lib/stat-groups";
import type { Photo } from "@portfolio/lib/photos";
import {
  type Daypart,
  DAYPARTS,
  daypartSpan,
  type ListKey,
  MONTHS,
  SEASONS,
  seasonSpan,
  type WhenChoice,
  WEEKDAYS,
} from "@portfolio/lib/when-filters";

/** A choice of a "when" filter as a row, filtering to it. */
function choiceBucket(key: ListKey, detail?: (choice: WhenChoice) => string) {
  return (choice: WhenChoice): Bucket => ({
    key: choice.value,
    label: choice.label,
    detail: detail?.(choice),
    filter: { [key]: [choice.value] },
  });
}

/** A group of a "when" filter's choices, in their own order. */
function choiceGroup<T extends WhenChoice>(
  title: string,
  key: ListKey,
  choices: T[],
  detail?: (choice: T) => string,
) {
  const byValue = new Map(choices.map((choice) => [choice.value, choice]));
  const buckets = choices.map(choiceBucket(key, detail as (choice: WhenChoice) => string));
  return (list: Photo[]): StatGroup =>
    bucketGroup(title, list, buckets, (photo, bucket) => byValue.get(bucket.key)!.matches(photo));
}

/** A part of the day as a row, filtering to its hours. */
function daypartBucket(daypart: Daypart): Bucket {
  const hours = daypart.hours.map((hour) => hour.value);
  return {
    key: daypart.label,
    label: daypart.label,
    detail: daypartSpan(daypart),
    filter: { hour: hours },
  };
}

/** Whether the photo was taken in the bucket's hours. */
function inHours(photo: Photo, bucket: Bucket): boolean {
  const hours: (string | number)[] = [bucket.filter?.hour ?? []].flat();
  return hours.includes(String(photo.takenAt.getHours()));
}

/** The year the photo was taken in. */
function yearOf(photo: Photo): string {
  return String(photo.takenAt.getFullYear());
}

/** A year as a row, filtering to its dates. */
function yearBucket(year: string): Bucket {
  return { key: year, label: year, filter: { start: `${year}-01-01`, end: `${year}-12-31` } };
}

/** Each year the photos were taken in, newest first. */
function yearGroup(list: Photo[]): StatGroup {
  const years = [...tally(list, yearOf).keys()].toSorted((a, b) => b.localeCompare(a));
  return bucketGroup("Year", list, years.map(yearBucket), (photo, b) => yearOf(photo) === b.key);
}

/** The Time section's groups: years (narrowing the seasons), seasons (narrowing the months), months, parts of the day and days of the week. */
export const TIME_GROUPS: GroupDef[] = [
  { id: "year", narrows: "season", build: yearGroup, runTitle: "Calendar" },
  { id: "season", narrows: "month", build: choiceGroup("Season", "season", SEASONS, seasonSpan) },
  { id: "month", build: choiceGroup("Month", "month", MONTHS) },
  {
    id: "daypart",
    build: (list) => bucketGroup("Time of day", list, DAYPARTS.map(daypartBucket), inHours),
  },
  { id: "weekday", build: choiceGroup("Day of the week", "weekday", WEEKDAYS) },
];
