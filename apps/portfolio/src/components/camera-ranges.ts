import type { RangePreset } from "@portfolio/components/range-presets";
import {
  groupRange,
  parseRange,
  RANGE_KEYS,
  type RangeKey,
  rangeValues,
} from "@portfolio/lib/camera-filters";
import { groupTree } from "@portfolio/lib/metadata-groups";
import { SETTING_FORMATS } from "@portfolio/lib/photo-settings";
import type { Photo } from "@portfolio/lib/photos";

/** Each camera setting's name, as the Camera picker lists it. */
export const RANGE_LABELS: Record<RangeKey, string> = {
  iso: "ISO",
  exposure: "Exposure",
  focalLength: "Focal length",
  aperture: "Aperture",
};

/**
 * A setting's value as a photographer writes it, such as "f/5.6" or "1/60s". ISO is just the
 * number, as the slider's name already says ISO.
 */
export function writeSetting(key: RangeKey): (value: string) => string {
  const write = SETTING_FORMATS.find(([name]) => name === key && key !== "iso")?.[1];
  return (value) => (write ? write(value) : value);
}

/**
 * A range as the photos write its ends, such as "11mm – 24mm" or "250 – 1600 ISO", or the one
 * value when they're the same.
 */
export function spanText(key: RangeKey, range: string): string {
  const write = writeSetting(key);
  const [low = "", high = ""] = parseRange(range) ?? [];
  const text = low === high ? write(low) : `${write(low)} – ${write(high)}`;
  return key === "iso" ? `${text} ISO` : text;
}

/** Each slider's steps and quick picks, worked out from one set of photos. */
export interface CameraRanges {
  /** The steps of each slider: every value the photos have, so they don't move as filters change. */
  values: Record<RangeKey, string[]>;
  /** Each slider's quick picks: the metadata groups of its setting with photos in their range. */
  presets: Record<RangeKey, RangePreset[]>;
}

/** The ranges already worked out, by the photo list they came from, so each list is read once. */
const rangesByPhotos = new WeakMap<Photo[], CameraRanges>();

/**
 * The Camera picker's slider steps and quick picks for a view's photos before any filter: the
 * portfolio's photos on the portfolio, and the Gallery's own photos in the pipeline.
 */
export function cameraRanges(photos: Photo[]): CameraRanges {
  const known = rangesByPhotos.get(photos);
  if (known) return known;
  const values = Object.fromEntries(
    RANGE_KEYS.map((key) => [key, rangeValues(photos, key)]),
  ) as Record<RangeKey, string[]>;
  const presets = Object.fromEntries(
    RANGE_KEYS.map((key) => [
      key,
      groupTree(key).flatMap(([group]): RangePreset[] => {
        const range = groupRange(key, group, values[key]);
        // A group no photo is in isn't shown.
        if (!range) return [];
        return [{ id: group.id, name: group.name, span: spanText(key, range), range }];
      }),
    ]),
  ) as Record<RangeKey, RangePreset[]>;
  const ranges = { values, presets };
  rangesByPhotos.set(photos, ranges);
  return ranges;
}
