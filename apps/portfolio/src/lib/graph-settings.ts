import { type RangeKey, rangeValues } from "@portfolio/lib/camera-filters";
import type { GraphStat } from "@portfolio/lib/graph-data";
import { type Photo, SETTING_FORMATS } from "@portfolio/lib/photos";
import { type Bucket, bucketGroup, type StatGroup } from "@portfolio/lib/stat-groups";

/** A camera setting's value as a row: written as a photographer would, filtering to just that value. */
function settingBucket(key: RangeKey, value: string): Bucket {
  const write = SETTING_FORMATS.find(([name]) => name === key)![1];
  return { key: value, label: write(value), filter: { [key]: `${value}-${value}` } };
}

/** A group of the setting's values the photos have, lowest first, such as f/1.4 to f/16. */
function settingGroup(key: RangeKey, title: string) {
  return (list: Photo[]): StatGroup =>
    bucketGroup(
      title,
      list,
      rangeValues(list, key).map((value) => settingBucket(key, value)),
      (photo, bucket) => String(photo.settings[key]) === bucket.key,
    );
}

/** The camera settings as stats for the Graph page, under Technical: each value the photos were taken at. */
export const SETTING_STATS: GraphStat[] = (
  [
    ["aperture", "Aperture"],
    ["exposure", "Exposure"],
    ["iso", "ISO"],
    ["focalLength", "Focal length (mm)"],
  ] as const
).map(([key, label]) => ({
  id: key,
  label,
  section: "Technical",
  build: settingGroup(key, label),
}));
