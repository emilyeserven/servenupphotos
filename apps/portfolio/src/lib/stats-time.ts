import { type Bucket, bucketGroup, type GroupDef, type StatGroup, tally } from "@/lib/stat-groups";
import type { Photo } from "@/lib/photos";
import { photoHours } from "@/lib/time-of-day";
import { photos as allPhotos } from "@/lib/photos";
import {
  DAYPARTS,
  daypartRange,
  daypartSpan,
  MONTHS,
  type Season,
  SEASONS,
  seasonSpan,
  type WhenChoice,
  WEEKDAYS,
} from "@/lib/when-filters";

/** Every hour of the day a portfolio photo was taken in, which the hours filter steps through. */
const HOURS = photoHours(allPhotos);

/** A month or day of the week as a row, filtering to it. */
function choiceBucket(key: "month" | "weekday") {
  return (choice: WhenChoice): Bucket => ({
    key: choice.value,
    label: choice.label,
    filter: { [key]: [choice.value] },
  });
}

/** A group of months or days of the week, in their own order. */
function choiceGroup(title: string, key: "month" | "weekday", choices: WhenChoice[]) {
  return (list: Photo[]): StatGroup => {
    const byValue = new Map(choices.map((choice) => [choice.value, choice]));
    return bucketGroup(title, list, choices.map(choiceBucket(key)), (photo, bucket) =>
      byValue.get(bucket.key)!.matches(photo),
    );
  };
}

/** A season as a row, filtering to its three months. */
function seasonBucket(season: Season): Bucket {
  const months = season.months.map((month) => month.value);
  return {
    key: season.value,
    label: season.label,
    detail: seasonSpan(season),
    filter: { month: months },
  };
}

/** Whether the photo was taken in the season's months. */
function inSeason(photo: Photo, bucket: Bucket): boolean {
  const months = bucket.filter?.month ?? [];
  return MONTHS.some((month) => months.includes(month.value) && month.matches(photo));
}

/** The parts of the day as rows, filtering to their hours; one no photo is in is left out. */
const daypartBuckets: Bucket[] = DAYPARTS.flatMap((daypart) => {
  const time = daypartRange(daypart, HOURS);
  return time
    ? [{ key: time, label: daypart.label, detail: daypartSpan(daypart), filter: { time } }]
    : [];
});

/** Whether the photo was taken within the bucket's hours. */
function inHours(photo: Photo, bucket: Bucket): boolean {
  const [low = 0, high = 0] = bucket.key.split("-").map(Number);
  const hour = photo.takenAt.getHours();
  return hour >= low && hour <= high;
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

/** The Time section's groups: parts of the day, seasons (narrowing the months), months, days of the week and years. */
export const TIME_GROUPS: GroupDef[] = [
  { id: "daypart", build: (list) => bucketGroup("Time of day", list, daypartBuckets, inHours) },
  {
    id: "season",
    narrows: "month",
    build: (list) => bucketGroup("Season", list, SEASONS.map(seasonBucket), inSeason),
  },
  { id: "month", build: choiceGroup("Month", "month", MONTHS) },
  { id: "weekday", build: choiceGroup("Day of the week", "weekday", WEEKDAYS) },
  { id: "year", build: yearGroup },
];
