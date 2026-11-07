import { groupRange, parseRange, rangeValues } from "@/lib/camera-filters";
import { groupTree, type MetaGroup } from "@/lib/metadata-groups";
import { type Photo, photos } from "@/lib/photos";

/** Where a row on the Stats page links: a view and its search, such as the Grid filtered to a camera. */
export interface StatLink {
  to: "/grid" | "/timeline";
  search: Record<string, string>;
}

/** One row of a group on the Stats page: a value, such as a camera, and how many photos have it. */
export interface StatRow {
  label: string;
  /** A second, quieter line, such as a city's country or a range's millimeters. */
  detail?: string;
  count: number;
  /** The photos it counts on another view; left out when no view filters by it. */
  link?: StatLink;
}

/** A group of rows on the Stats page, such as Cameras or Times of day. */
export interface StatGroup {
  title: string;
  rows: StatRow[];
  /** How many photos don't say, such as ones without a camera in their EXIF. */
  missing: number;
  /** Whether the rows have an order of their own, such as the months, rather than biggest first. */
  ordered: boolean;
}

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

/** A key photos are counted by, with the row's label, detail and link for it. */
interface Bucket {
  key: string;
  label: string;
  detail?: string;
  link?: StatLink;
}

/** How many photos have each key, the photos whose key is null left out. */
function tally(list: Photo[], keyOf: (photo: Photo) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const photo of list) {
    const key = keyOf(photo);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** How many photos the key leaves out, as they don't say. */
function missingCount(list: Photo[], keyOf: (photo: Photo) => string | null): number {
  return list.filter((photo) => keyOf(photo) === null).length;
}

/** A group whose rows are every value the photos have, biggest first, then by name. */
function valueGroup(
  title: string,
  list: Photo[],
  keyOf: (photo: Photo) => string | null,
  bucketOf: (key: string) => Bucket,
): StatGroup {
  const rows = [...tally(list, keyOf)]
    .map(([key, count]) => ({ ...rowOf(bucketOf(key)), count }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { title, rows, missing: missingCount(list, keyOf), ordered: false };
}

/** A group whose rows are the buckets in their own order, empty ones left out. */
function bucketGroup(
  title: string,
  list: Photo[],
  keyOf: (photo: Photo) => string | null,
  buckets: Bucket[],
): StatGroup {
  const counts = tally(list, keyOf);
  const rows = buckets
    .map((bucket) => ({ ...rowOf(bucket), count: counts.get(bucket.key) ?? 0 }))
    .filter((row) => row.count > 0);
  return { title, rows, missing: missingCount(list, keyOf), ordered: true };
}

/** A bucket's row, without its count. */
function rowOf({ label, detail, link }: Bucket): Omit<StatRow, "count"> {
  return { label, detail, link };
}

/** A link to the Grid filtered by one value, such as `/grid?camera=…`. */
function gridLink(key: string, value: string): StatLink {
  return { to: "/grid", search: { [key]: value } };
}

/** A focal length range from METAINFO.json, with the Grid's range filter for the photos in it. */
function focalBucket(group: MetaGroup, values: string[]): Bucket {
  const range = groupRange("focalLength", group, values);
  return {
    key: group.id,
    label: group.name,
    detail: rangeText(group),
    link: range ? gridLink("focalLength", range) : undefined,
  };
}

/** A focal length group's range in millimeters, such as "23–39mm", "251mm+" or "≤22mm". */
function rangeText({ range = {} }: MetaGroup): string {
  const { min, max } = range;
  if (min === undefined) return `≤${max}mm`;
  return max === undefined ? `${min}mm+` : `${min}–${max}mm`;
}

/** Where a focal length group starts, so the widest comes first. */
function rangeStart(group: MetaGroup): number {
  return group.range?.min ?? 0;
}

/** The focal length range groups, from widest to longest, each with the photos' values in it. */
function focalBuckets(list: Photo[]) {
  const values = rangeValues(list, "focalLength");
  return groupTree("focalLength")
    .filter(([, depth]) => depth === 0)
    .map(([group]) => group)
    .toSorted((a, b) => rangeStart(a) - rangeStart(b))
    .map((group) => ({ bucket: focalBucket(group, values), span: groupSpanOf(group, values) }));
}

/** The lowest and highest focal lengths the photos have in the group, from its Grid range. */
function groupSpanOf(group: MetaGroup, values: string[]): [number, number] | undefined {
  const range = parseRange(groupRange("focalLength", group, values));
  return range ? [Number(range[0]), Number(range[1])] : undefined;
}

/** The focal length range a photo is in, by its ID; null when it has no focal length or none fits. */
function focalKey(spans: ReturnType<typeof focalBuckets>) {
  return (photo: Photo): string | null => {
    const length = photo.settings.focalLength;
    if (length === null) return null;
    const found = spans.find(({ span }) => span && length >= span[0] && length <= span[1]);
    return found?.bucket.key ?? null;
  };
}

/** The focal length ranges set on the pipeline's Metadata Groups page, widest first. */
function focalGroup(list: Photo[]): StatGroup {
  const spans = focalBuckets(list);
  const buckets = spans.map(({ bucket }) => bucket);
  return bucketGroup("Focal length", list, focalKey(spans), buckets);
}

/** The Gear section: cameras, lenses and focal length ranges. */
function gearSection(list: Photo[]): StatSection {
  return {
    id: "gear",
    title: "Gear",
    description: "What the photos were taken with.",
    groups: [
      valueGroup("Cameras", list, cameraOf, cameraBucket),
      valueGroup("Lenses", list, (photo) => photo.lens, lensBucket),
      focalGroup(list),
    ],
  };
}

/** What the photos have for "no camera" in place of one. */
const UNKNOWN_CAMERA = "Unknown camera";

/** The photo's camera, or null when its EXIF didn't say. */
function cameraOf(photo: Photo): string | null {
  return photo.camera === UNKNOWN_CAMERA ? null : photo.camera;
}

/** A camera's row, linking to the Grid filtered to it. */
function cameraBucket(camera: string): Bucket {
  return { key: camera, label: camera, link: gridLink("camera", camera) };
}

/** A lens's row, linking to the Grid filtered to it. */
function lensBucket(lens: string): Bucket {
  return { key: lens, label: lens, link: gridLink("lens", lens) };
}

/** Each city's country, by the city's English name, as the photos have them. */
function cityCountries(list: Photo[]): Map<string, string> {
  return new Map(list.flatMap((p) => (p.city && p.country ? [[p.city, p.country]] : [])));
}

/** The Places section: countries and cities. */
function placesSection(list: Photo[]): StatSection {
  const countries = cityCountries(list);
  return {
    id: "places",
    title: "Places",
    description: "Where the photos were taken.",
    groups: [
      valueGroup(
        "Countries",
        list,
        (photo) => photo.country,
        (country) => ({
          key: country,
          label: country,
          link: gridLink("country", country),
        }),
      ),
      valueGroup(
        "Cities",
        list,
        (photo) => photo.city,
        (city) => ({
          key: city,
          label: city,
          detail: countries.get(city),
          link: gridLink("city", city),
        }),
      ),
    ],
  };
}

/** The parts of the day, each a range of hours the Grid's time of day filter takes. */
const TIMES_OF_DAY: [string, number, number][] = [
  ["Late night", 0, 4],
  ["Early morning", 5, 7],
  ["Morning", 8, 11],
  ["Afternoon", 12, 16],
  ["Evening", 17, 20],
  ["Night", 21, 23],
];

/** An hour as a 12-hour clock writes it, such as "5 AM" or "12 PM". */
function hourText(hour: number): string {
  return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** The part of the day the photo was taken in, by the clock where it was taken. */
function timeOfDayKey(photo: Photo): string {
  const hour = photo.takenAt.getHours();
  return TIMES_OF_DAY.find(([, low, high]) => hour >= low && hour <= high)![0];
}

/** The parts of the day, each linking to the Grid's time of day filter for its hours. */
const timeOfDayBuckets: Bucket[] = TIMES_OF_DAY.map(([label, low, high]) => ({
  key: label,
  label,
  detail: `${hourText(low)}–${hourText(high + 1)}`,
  link: gridLink("time", `${low}-${high}`),
}));

/** The seasons, by the months they start and end in (northern hemisphere), winter wrapping round. */
const SEASONS: [string, number[]][] = [
  ["Spring", [2, 3, 4]],
  ["Summer", [5, 6, 7]],
  ["Autumn", [8, 9, 10]],
  ["Winter", [11, 0, 1]],
];

/** The season the photo was taken in. */
function seasonKey(photo: Photo): string {
  const month = photo.takenAt.getMonth();
  return SEASONS.find(([, months]) => months.includes(month))![0];
}

/** The month name, such as "Mar", for each month's number from 0. */
function monthName(month: number, style: "short" | "long" = "long"): string {
  return new Date(2000, month, 1).toLocaleString("en-US", { month: style });
}

const seasonBuckets: Bucket[] = SEASONS.map(([label, months]) => ({
  key: label,
  label,
  detail: `${monthName(months[0]!, "short")}–${monthName(months[2]!, "short")}`,
}));

const monthBuckets: Bucket[] = Array.from({ length: 12 }, (_, month) => ({
  key: String(month),
  label: monthName(month),
}));

const weekdayBuckets: Bucket[] = Array.from({ length: 7 }, (_, day) => ({
  key: String(day),
  // 2023-01-01 was a Sunday, so day 0 is Sunday as getDay() counts.
  label: new Date(2023, 0, 1 + day).toLocaleString("en-US", { weekday: "long" }),
}));

/** Each year the photos were taken in, newest first, linking to the Timeline narrowed to it. */
function yearBuckets(list: Photo[]): Bucket[] {
  const years = [...new Set(list.map((photo) => photo.takenAt.getFullYear()))].toSorted(
    (a, b) => b - a,
  );
  return years.map((year) => ({
    key: String(year),
    label: String(year),
    link: { to: "/timeline", search: { from: `${year}-01-01`, to: `${year}-12-31` } },
  }));
}

/** The Time section: times of day, seasons, months, days of the week and years. */
function timeSection(list: Photo[]): StatSection {
  return {
    id: "time",
    title: "Time",
    description: "When the photos were taken, by the clock and calendar where they were.",
    groups: [
      bucketGroup("Time of day", list, timeOfDayKey, timeOfDayBuckets),
      bucketGroup("Season", list, seasonKey, seasonBuckets),
      bucketGroup("Month", list, (photo) => String(photo.takenAt.getMonth()), monthBuckets),
      bucketGroup(
        "Day of the week",
        list,
        (photo) => String(photo.takenAt.getDay()),
        weekdayBuckets,
      ),
      bucketGroup("Year", list, (photo) => String(photo.takenAt.getFullYear()), yearBuckets(list)),
    ],
  };
}

/** Every section of the Stats page, counting the photos given. */
export function statSections(list: Photo[] = photos): StatSection[] {
  return [gearSection(list), placesSection(list), timeSection(list)];
}

/** How many different values the photos have, leaving out the ones that don't say. */
function distinct(list: Photo[], keyOf: (photo: Photo) => string | null): number {
  return tally(list, keyOf).size;
}

/** The headline numbers for the top of the Stats page. */
export function statTotals(list: Photo[] = photos): StatTotals {
  return {
    photos: list.length,
    cameras: distinct(list, cameraOf),
    countries: distinct(list, (photo) => photo.country),
    cities: distinct(list, (photo) => photo.city),
    years: distinct(list, (photo) => String(photo.takenAt.getFullYear())),
  };
}
