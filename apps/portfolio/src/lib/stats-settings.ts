import { type Bucket, bucketGroup, type StatGroup } from "@portfolio/lib/stat-groups";
import {
  groupRange,
  parseRange,
  type RangeKey,
  rangeValues,
  settingNumber,
} from "@portfolio/lib/camera-filters";
import { groupTree, type MetaGroup } from "@portfolio/lib/metadata-groups";
import { type Photo, photos as allPhotos } from "@portfolio/lib/photos";

/** A shutter speed in seconds as a photographer writes it, such as "1/250" or "2". */
function shutterText(seconds: number): string {
  return seconds < 1 ? `1/${Math.round(1 / seconds)}` : String(Math.round(seconds * 10) / 10);
}

/** How each setting's range ends are written, such as "f/2" or "1/250". */
const END_TEXT: Record<RangeKey, (value: number) => string> = {
  aperture: (value) => `f/${value}`,
  exposure: shutterText,
  iso: (value) => String(value),
  focalLength: (value) => String(value),
};

/** What follows a setting's range, such as "mm" or "s". */
const UNITS: Record<RangeKey, string> = { aperture: "", exposure: "s", iso: "", focalLength: "mm" };

/** A range group's span, such as "23–39mm", "251mm+" or "≤1/800s". */
function rangeText(key: RangeKey, { range = {} }: MetaGroup): string {
  const write = (value: number) => `${END_TEXT[key](value)}${UNITS[key]}`;
  const { min, max } = range;
  if (min === undefined) return `≤${write(max ?? 0)}`;
  return max === undefined ? `${write(min)}+` : `${END_TEXT[key](min)}–${write(max)}`;
}

/**
 * A setting's range group from METAINFO.json as a row, with the Grid's range filter for it: from
 * the lowest to the highest value any portfolio photo has in it, so the count matches the Grid.
 */
function settingBucket(key: RangeKey, group: MetaGroup, values: string[]): Bucket {
  const range = groupRange(key, group, values);
  return {
    key: range ?? "",
    label: group.name,
    detail: rangeText(key, group),
    filter: range ? { [key]: range } : undefined,
  };
}

/** A setting's value as a number, or NaN when there's none, which is in no range. */
function numberOf(key: RangeKey, value: string | number | null): number {
  return settingNumber(key, value) ?? Number.NaN;
}

/** Whether the photo's setting is in the bucket's range. */
function inSettingRange(key: RangeKey) {
  return (photo: Photo, bucket: Bucket): boolean => {
    const [low = "", high = ""] = parseRange(bucket.key) ?? [];
    const value = numberOf(key, photo.settings[key]);
    return value >= numberOf(key, low) && value <= numberOf(key, high);
  };
}

/**
 * A group of a setting's top-level range groups set on the pipeline's Metadata Groups page, such as
 * Aperture's Fast and Narrow, in their order; the ones without photos left out unless `keepEmpty`.
 */
export function settingGroup(key: RangeKey, title: string, keepEmpty = false) {
  const values = rangeValues(allPhotos, key);
  const buckets = groupTree(key)
    .filter(([, depth]) => depth === 0)
    .map(([group]) => settingBucket(key, group, values));
  return (list: Photo[]): StatGroup =>
    bucketGroup(title, list, buckets, inSettingRange(key), keepEmpty);
}
