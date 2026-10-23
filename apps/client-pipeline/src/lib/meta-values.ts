import type { MetaField, MetaGroup, MetaValue } from "@/api/metainfo";
import type { CombinedPhoto } from "@/lib/group-photos";

/** One value of a field, with how many photos have it (0 for a value only a group lists). */
export interface MetaValueCount {
  value: MetaValue;
  count: number;
}

/** A value as a key to tell values apart by: 11 and "11" are different values. */
export function valueKey(value: MetaValue): string {
  return JSON.stringify(value);
}

function isValue(value: unknown): value is MetaValue {
  return (typeof value === "string" && value.trim() !== "") || typeof value === "number";
}

/** An exposure such as "1/6" or "30" as seconds, so exposures sort by length. */
function exposureSeconds(value: string): number {
  const [top = Number.NaN, bottom] = value.split("/").map(Number);
  return bottom ? top / bottom : top;
}

/** What a value sorts by: itself for a number, its length for an exposure. */
function sortNumber(value: MetaValue): number {
  return typeof value === "number" ? value : exposureSeconds(value);
}

/** Sorts numbers and exposures from smallest to largest, then everything else by name. */
function compareValues(a: MetaValue, b: MetaValue): number {
  const byNumber = sortNumber(a) - sortNumber(b);
  return Number.isNaN(byNumber) || byNumber === 0
    ? String(a).localeCompare(String(b), "en")
    : byNumber;
}

function countIn(counts: Map<string, MetaValueCount>, value: MetaValue, by: number) {
  const key = valueKey(value);
  const known = counts.get(key);
  counts.set(key, { value, count: (known?.count ?? 0) + by });
}

/**
 * Every value of field the photos have, and every one the groups list, each once with how many
 * photos have it, sorted.
 */
export function fieldValues(
  photos: CombinedPhoto[],
  groups: MetaGroup[],
  field: MetaField,
): MetaValueCount[] {
  const counts = new Map<string, MetaValueCount>();
  for (const value of photos.map((photo) => photo[field]).filter(isValue)) {
    countIn(counts, value, 1);
  }
  for (const value of groups.flatMap((group) => group.values)) countIn(counts, value, 0);
  return [...counts.values()].toSorted((a, b) => compareValues(a.value, b.value));
}

const UNITS: Partial<Record<MetaField, (value: MetaValue) => string>> = {
  focalLength: (value) => `${value} mm`,
  aperture: (value) => `f/${value}`,
  exposure: (value) => `${value} s`,
  iso: (value) => `ISO ${value}`,
};

/** A value as the page shows it, such as "11 mm" for a focal length. */
export function showValue(field: MetaField, value: MetaValue): string {
  return UNITS[field]?.(value) ?? String(value);
}

/**
 * Typed text as a value of the field: a number for a numeric field when it reads as one, else the
 * trimmed text; undefined when it's empty.
 */
export function typedValue(text: string, numeric: boolean): MetaValue | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  return numeric && Number.isFinite(number) ? number : trimmed;
}

/** The values from `from` to `to`, both included, of the numeric ones in values. */
export function valuesBetween(values: MetaValueCount[], from: number, to: number): MetaValue[] {
  const [low, high] = from <= to ? [from, to] : [to, from];
  return values
    .map((v) => v.value)
    .filter((value) => typeof value === "number" && value >= low && value <= high);
}

/** How many photos have one of the group's values. */
export function groupPhotoCount(values: MetaValueCount[], group: MetaGroup): number {
  const keys = new Set(group.values.map(valueKey));
  return values.filter((v) => keys.has(valueKey(v.value))).reduce((sum, v) => sum + v.count, 0);
}
