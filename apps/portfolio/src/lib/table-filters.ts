import { groupAndInside, groupValues, metaGroupById, type MetaGroup } from "@/lib/metadata-groups";
import type { CameraSettings, Photo } from "@/lib/photos";

/** The camera settings the Table's range sliders narrow by, named as they are in the URL. */
export const RANGE_KEYS = ["iso", "exposure", "focalLength", "aperture"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

/** The camera and lens filters, each matching one by name. */
const EQUIPMENT_KEYS = ["camera", "lens"] as const;

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

/** The camera and lens group filters, each matching the values of one metadata group. */
const EQUIPMENT_GROUP_KEYS = ["cameraGroup", "lensGroup"] as const;

/** The Table's own filters as they're named in the URL; the other views don't have them. */
export const TABLE_FILTER_KEYS = [
  ...EQUIPMENT_KEYS,
  ...EQUIPMENT_GROUP_KEYS,
  ...RANGE_KEYS,
] as const;

/**
 * The Table's own filters, each left out when it isn't set: one camera or camera group, one lens
 * or lens group (by its metadata group's ID), and a range of each setting written as its lowest
 * and highest value as the photos have them, such as "100-400" or "1/500-1/30".
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

/** A metadata group's value as a number, as the group's file reads it: "24 mm" is 24. */
function groupNumber(key: RangeKey, value: string | number): number | undefined {
  const number = settingNumber(key, value) ?? Number.NaN;
  if (Number.isFinite(number)) return number;
  const first = /-?\d+(\.\d+)?/.exec(String(value));
  return first ? Number(first[0]) : undefined;
}

/** Every number a range group covers the ends of: its range and its values, and those of the groups in it. */
function groupNumbers(key: RangeKey, group: MetaGroup): number[] {
  return groupAndInside(group).flatMap(({ range, values }) => [
    ...(range ? [range.min, range.max] : []),
    ...values.flatMap((value) => groupNumber(key, value) ?? []),
  ]);
}

/**
 * The range a slider's quick-select sets for a metadata group: from the lowest value the photos
 * have at or above the group's lowest end to the highest at or below its highest, so the slider
 * can show it, such as "11-24" for Wide angle's 10 to 24 mm. Undefined when no photo is in it.
 */
export function groupRange(key: RangeKey, group: MetaGroup, values: string[]): string | undefined {
  const [low = Number.NaN, high = Number.NaN] = groupSpan(key, group) ?? [];
  const inside = values.filter((value) => {
    const number = settingNumber(key, value) ?? Number.NaN;
    return number >= low && number <= high;
  });
  return inside.length > 0 ? `${inside[0]}-${inside.at(-1)}` : undefined;
}

/** The lowest and highest ends a range group covers, such as [10, 24]; undefined when it has none. */
export function groupSpan(key: RangeKey, group: MetaGroup): [number, number] | undefined {
  const numbers = groupNumbers(key, group);
  return numbers.length > 0 ? [Math.min(...numbers), Math.max(...numbers)] : undefined;
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

/** Whether the photo's camera or lens is in the metadata group with the ID; none is in a group that isn't there. */
function inEquipmentGroup(photo: Photo, key: EquipmentKey, id: string): boolean {
  const group = metaGroupById(key, id);
  return group !== undefined && groupValues(group).has(photo[key] ?? "");
}

/** Whether the photo's camera or lens is the one chosen, or in the group chosen, or neither is. */
function matchesEquipment(photo: Photo, key: EquipmentKey, filters: TableFilters): boolean {
  const [name, group] = [filters[key], filters[`${key}Group`]];
  if (name !== undefined && photo[key] !== name) return false;
  return group === undefined || inEquipmentGroup(photo, key, group);
}

/** Whether the photo matches every one of the Table's own filters that's set. */
function matchesTableFilters(photo: Photo, filters: TableFilters): boolean {
  return (
    EQUIPMENT_KEYS.every((key) => matchesEquipment(photo, key, filters)) &&
    RANGE_KEYS.every((key) => {
      const range = parseRange(filters[key]);
      return !range || inRange(photo, key, range);
    })
  );
}

/** The photos matching every one of the Table's own filters that's set, in the same order. */
export function filterTable(list: Photo[], filters: TableFilters): Photo[] {
  return list.filter((photo) => matchesTableFilters(photo, filters));
}

/** The Table's filters with the ones named left out, so their choices count what the others leave. */
export function withoutTableFilters(
  filters: TableFilters,
  keys: readonly (keyof TableFilters)[],
): TableFilters {
  return { ...filters, ...Object.fromEntries(keys.map((key) => [key, undefined])) };
}
