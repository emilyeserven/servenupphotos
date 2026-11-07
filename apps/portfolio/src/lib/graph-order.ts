import { type SortOrder, statById } from "@portfolio/lib/graph-data";
import { photos as allPhotos } from "@portfolio/lib/photos";
import type { StatRow } from "@portfolio/lib/stat-groups";

/** Whether a row's name is a plain whole number, such as a year. */
function isWhole(row: StatRow | undefined): boolean {
  return row !== undefined && /^\d+$/.test(row.label);
}

/**
 * Whether the stat's own order runs from high to low, as Year's does (newest first): its first
 * and last values are plain numbers going down. Every other order, such as Aperture's or the
 * months', counts as running up.
 */
function runsDown(stat: string): boolean {
  const rows = statById(stat).build(allPhotos).rows;
  const [first, last] = [rows[0], rows.at(-1)];
  return isWhole(first) && isWhole(last) && Number(first!.label) > Number(last!.label);
}

/**
 * The x axis's orders as the Axes picker offers them, named by the axis, such as "X axis, asc":
 * low to high, high to low, and most photos first. Which of the stat's own order and its reverse
 * is which depends on the way the stat's own order runs.
 */
export function orderChoices(stat: string, axis: string): [SortOrder, string][] {
  const [asc, desc]: [SortOrder, SortOrder] = runsDown(stat)
    ? ["reverse", "group"]
    : ["group", "reverse"];
  return [
    [asc, `${axis}, asc`],
    [desc, `${axis}, desc`],
    ["count", "Most photos first"],
  ];
}

/** The order's name, such as "X axis, asc". */
export function orderName(stat: string, axis: string, sort: SortOrder): string {
  return orderChoices(stat, axis).find(([value]) => value === sort)?.[1] ?? "";
}
