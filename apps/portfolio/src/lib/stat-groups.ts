import type { Photo } from "@portfolio/lib/photos";

/** One row of a group on the Stats page: a value, such as a camera, and how many photos have it. */
export interface StatRow {
  label: string;
  /** A quieter note after the label, such as a range's millimeters. */
  detail?: string;
  /** What shows on hover, such as a city's country. */
  hint?: string;
  count: number;
  /**
   * The row's value as a number, for a group whose values go in order, such as 2.8 for f/2.8, 1/60
   * for 1/60s or 2024 for a year; left out for the rest. The Graph page's axis thresholds compare it.
   */
  value?: number;
  /**
   * The filter that narrows the photos to the row's, as the URL writes it, such as
   * `{ camera: "Fujifilm X-T5" }`; left out when no filter can.
   */
  filter?: Record<string, string | string[]>;
}

/** A group of rows on the Stats page, such as Cameras or Time of day. */
export interface StatGroup {
  title: string;
  rows: StatRow[];
  /** How many photos it couldn't count, such as ones without a camera in their EXIF. */
  missing: number;
  /** Why it couldn't count them: they don't say, or they aren't in any of its categories. */
  missingReason: "unknown" | "uncategorized";
}

/**
 * How the Stats page makes a group from the photos. A group that `narrows` another, such as
 * Countries narrowing Cities, picks which of its photos that one counts: clicking one of its rows
 * narrows the other group to the row's photos instead of opening them on the Grid.
 */
export interface GroupDef {
  id: string;
  build: (list: Photo[]) => StatGroup;
  /** The ID of the group its rows narrow. */
  narrows?: string;
  /** Whether its rows have a `value`, so a graph's axis can be cut to a range of them. */
  ordered?: boolean;
  /**
   * Other ways to make it, picked from a dropdown in place of its title, such as Lenses by type or
   * by brand; the first is shown at first. `build` is left for the rest of the page to name it by.
   */
  variants?: GroupVariant[];
}

/** One way to make a group with variants, such as Lenses by brand. */
export interface GroupVariant {
  label: string;
  build: (list: Photo[]) => StatGroup;
}

/** A key photos are counted by, with its row's text and filter. */
export type Bucket = Omit<StatRow, "count"> & { key: string };

/** How a group reads each photo's key: null when the photo doesn't say. */
export type KeyOf = (photo: Photo) => string | null;

/** How many photos have each key, the photos whose key is null left out. */
export function tally(list: Photo[], keyOf: KeyOf): Map<string, number> {
  const counts = new Map<string, number>();
  for (const photo of list) {
    const key = keyOf(photo);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** A bucket's row with its count, without the key. */
function rowOf({ key: _key, ...row }: Bucket, count: number): StatRow {
  return { ...row, count };
}

/** A group whose rows are every value the photos have, biggest first, then by name. */
export function valueGroup(
  title: string,
  list: Photo[],
  keyOf: KeyOf,
  bucketOf: (key: string) => Bucket,
): StatGroup {
  const rows = [...tally(list, keyOf)]
    .map(([key, count]) => rowOf(bucketOf(key), count))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const missing = list.filter((photo) => keyOf(photo) === null).length;
  return { title, rows, missing, missingReason: "unknown" };
}

/**
 * A group whose rows are the buckets in their own order, empty ones left out. A photo can be in
 * more than one, or none: `inside` says which buckets it's in.
 */
export function bucketGroup(
  title: string,
  list: Photo[],
  buckets: Bucket[],
  inside: (photo: Photo, bucket: Bucket) => boolean,
): StatGroup {
  const rows = buckets
    .map((bucket) => rowOf(bucket, list.filter((photo) => inside(photo, bucket)).length))
    .filter((row) => row.count > 0);
  const missing = list.filter((photo) => !buckets.some((b) => inside(photo, b))).length;
  return { title, rows, missing, missingReason: "unknown" };
}

/**
 * A section's groups laid out in runs: each group that narrows another with the groups it narrows
 * down the line, such as Countries then Cities, and the groups between them on their own, in order.
 */
export function groupChains(groups: GroupDef[]): GroupDef[][] {
  const narrowed = new Set(groups.map((def) => def.narrows));
  const chains: GroupDef[][] = [];
  for (const def of groups.filter((g) => !narrowed.has(g.id))) {
    const chain = [def];
    let next = groups.find((g) => g.id === chain.at(-1)!.narrows);
    while (next && !chain.includes(next)) {
      chain.push(next);
      next = groups.find((g) => g.id === next!.narrows);
    }
    chains.push(chain);
  }
  return chains;
}
