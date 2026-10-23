import type { CameraSettings, Photo } from "@/lib/photos";

/** The camera settings the Table's range sliders narrow by, named as they are in the URL. */
export const RANGE_KEYS = ["iso", "exposure", "focalLength", "aperture"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

/** The Table's own filters as they're named in the URL; the other views don't have them. */
export const TABLE_FILTER_KEYS = ["camera", ...RANGE_KEYS] as const;

/**
 * The Table's own filters, each left out when it isn't set: one camera, and a range of each
 * setting written as its lowest and highest value as the photos have them, such as "100-400" or
 * "1/500-1/30".
 */
export type TableFilters = Partial<Record<(typeof TABLE_FILTER_KEYS)[number], string>>;

/** The Table's own filters in the URL's search, leaving out anything empty or not text. */
export function parseTableFilters(search: Record<string, unknown>): TableFilters {
  return Object.fromEntries(
    TABLE_FILTER_KEYS.flatMap((key) => {
      const value = search[key];
      return typeof value === "string" && value !== "" ? [[key, value]] : [];
    }),
  );
}

/** Exiftool's exposure time, such as "1/60" or "2.5", in seconds, so exposures sort by length. */
export function exposureSeconds(exposure: string | null): number | undefined {
  if (!exposure) return undefined;
  const [top = Number.NaN, bottom] = exposure.split("/").map(Number);
  const seconds = bottom ? top / bottom : top;
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** A setting's value as a number to compare, such as 1/60 for "1/60"; undefined when it's missing. */
function settingNumber(key: RangeKey, value: CameraSettings[RangeKey]): number | undefined {
  if (value === null) return undefined;
  return key === "exposure" ? exposureSeconds(String(value)) : Number(value);
}

/** The setting's values the photos have, each once, lowest first, as they're written. */
export function rangeValues(list: Photo[], key: RangeKey): string[] {
  const values = new Map<string, number>();
  for (const photo of list) {
    const value = photo.settings[key];
    const number = settingNumber(key, value);
    if (number !== undefined) values.set(String(value), number);
  }
  return [...values].toSorted(([, a], [, b]) => a - b).map(([text]) => text);
}

/** A range the URL writes as "low-high", as the two values; undefined when it isn't one. */
export function parseRange(range: string | undefined): [string, string] | undefined {
  const parts = range?.split("-") ?? [];
  return parts.length === 2 ? (parts as [string, string]) : undefined;
}

/** Whether the photo's setting is within the range; a photo without the setting isn't. */
function inRange(photo: Photo, key: RangeKey, range: [string, string]): boolean {
  const value = settingNumber(key, photo.settings[key]);
  const [low = Number.NaN, high = Number.NaN] = range.map((end) => settingNumber(key, end));
  return value !== undefined && value >= low && value <= high;
}

/** Whether the photo matches every one of the Table's own filters that's set. */
function matchesTableFilters(photo: Photo, filters: TableFilters): boolean {
  if (filters.camera !== undefined && photo.camera !== filters.camera) return false;
  return RANGE_KEYS.every((key) => {
    const range = parseRange(filters[key]);
    return !range || inRange(photo, key, range);
  });
}

/** The photos matching every one of the Table's own filters that's set, in the same order. */
export function filterTable(list: Photo[], filters: TableFilters): Photo[] {
  return list.filter((photo) => matchesTableFilters(photo, filters));
}

/** The Table's filters with the one named left out, so its choices count what the others leave. */
export function withoutTableFilter(filters: TableFilters, key: keyof TableFilters): TableFilters {
  return { ...filters, [key]: undefined };
}
