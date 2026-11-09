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
import { photos as allPhotos } from "@portfolio/lib/photos";

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

/** The steps of each slider: every value the portfolio's photos have, so they don't move as filters change. */
export const RANGE_VALUES = Object.fromEntries(
  RANGE_KEYS.map((key) => [key, rangeValues(allPhotos, key)]),
) as Record<RangeKey, string[]>;

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

/** Each slider's quick picks: the metadata groups of its setting with photos in their range. */
export const RANGE_PRESETS = Object.fromEntries(
  RANGE_KEYS.map((key) => [
    key,
    groupTree(key).flatMap(([group]): RangePreset[] => {
      const range = groupRange(key, group, RANGE_VALUES[key]);
      // A group no photo is in isn't shown.
      if (!range) return [];
      return [{ id: group.id, name: group.name, span: spanText(key, range), range }];
    }),
  ]),
) as Record<RangeKey, RangePreset[]>;
