import type { MetaField, MetaGroup, MetaRange, MetaValue } from "@/api/metainfo";
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

/** A fraction such as "1/250" as a number, or NaN when the text isn't one. */
function fraction(text: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(text);
  return match ? Number(match[1]) / Number(match[2]) : Number.NaN;
}

/**
 * A value as a number: itself for a number, and for text, a fraction such as "1/250" (an exposure
 * in seconds) or the first number in it ("24 mm" is 24). NaN when there's none.
 */
export function metaNumber(value: MetaValue): number {
  if (typeof value === "number") return value;
  const asFraction = fraction(value);
  return Number.isNaN(asFraction) ? Number.parseFloat(value.replace(/^[^\d.]+/, "")) : asFraction;
}

/** Sorts values from smallest to largest number, then everything else by name. */
function compareValues(a: MetaValue, b: MetaValue): number {
  const byNumber = metaNumber(a) - metaNumber(b);
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

/** A number of seconds as an exposure is written: "1/250" under a second, else "2". */
function exposureText(seconds: number): string {
  return seconds > 0 && seconds < 1 ? `1/${Math.round(1 / seconds)}` : String(seconds);
}

const UNITS: Partial<Record<MetaField, (value: MetaValue) => string>> = {
  focalLength: (value) => `${value} mm`,
  aperture: (value) => `f/${value}`,
  exposure: (value) => `${typeof value === "number" ? exposureText(value) : value} s`,
  iso: (value) => `ISO ${value}`,
};

/** A value as the page shows it, such as "11 mm" for a focal length. */
export function showValue(field: MetaField, value: MetaValue): string {
  return UNITS[field]?.(value) ?? String(value);
}

/** A range as the page shows it, such as "10–24 mm" or "1/250 s – 1/60 s". */
export function showRange(field: MetaField, range: MetaRange): string {
  const [low, high] = [showValue(field, range.min), showValue(field, range.max)];
  if (low === high) return low;
  return field === "focalLength" ? `${range.min}–${range.max} mm` : `${low} – ${high}`;
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

/** Whether value is in range, both ends included. */
function inRange(value: MetaValue, range: MetaRange): boolean {
  const n = metaNumber(value);
  return n >= range.min && n <= range.max;
}

/** Whether the group has value: in its range, or one of its values. */
export function hasValue(group: MetaGroup, value: MetaValue): boolean {
  if (group.range) return inRange(value, group.range);
  return group.values.some((v) => valueKey(v) === valueKey(value));
}

/** The values the photos have that are in range. */
export function valuesIn(values: MetaValueCount[], range: MetaRange): MetaValueCount[] {
  return values.filter((v) => v.count > 0 && inRange(v.value, range));
}
