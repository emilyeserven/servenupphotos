import type { StatRow } from "@portfolio/lib/stat-groups";

/** How many of an axis's values a bucket can put together; 0 leaves each value on its own. */
const BUCKET_SIZES = [0, 2, 3, 4, 5, 10];

/** The rows in runs of `size`, in their order; the last run can be shorter. */
function runsOf(rows: StatRow[], size: number): StatRow[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
    rows.slice(i * size, (i + 1) * size),
  );
}

/** A run of rows as one: named from its first to its last value, with all their photos. */
function bucketOf(run: StatRow[]): StatRow {
  const first = run[0]!;
  if (run.length === 1) return first;
  const label = `${first.label} – ${run.at(-1)!.label}`;
  return { label, count: run.reduce((sum, row) => sum + row.count, 0), parts: run };
}

/**
 * The axis's rows put together in buckets of `size` values in their own order, such as f/1.4 – f/2
 * then f/2.8 – f/4; the rows as they are when `size` is under 2.
 */
export function bucketRows(rows: StatRow[], size: number): StatRow[] {
  if (size < 2) return rows;
  return runsOf(rows, size).map(bucketOf);
}

/** Each value's bucket by its name, such as f/2 in f/1.4 – f/2, for counting a subset's rows into the buckets. */
export function bucketNames(rows: StatRow[], size: number): (label: string) => string {
  const names = new Map(
    bucketRows(rows, size).flatMap((bucket) =>
      (bucket.parts ?? [bucket]).map((row) => [row.label, bucket.label] as const),
    ),
  );
  return (label) => names.get(label) ?? label;
}

/** The sizes worth offering for an axis with this many values: those that put at least two together. */
export function bucketChoices(valueCount: number): number[] {
  return BUCKET_SIZES.filter((size) => size === 0 || size < valueCount);
}
