// The Gallery's sorts, each either way: date taken, date added, time of day, color and vividness,
// the last two with the portfolio's own color sort.
import { type ColorOrder, sortPhotos } from "@portfolio/lib/color-sort";
import type { Photo } from "@portfolio/lib/photos";
import { minuteOfDay } from "@portfolio/lib/time-of-day";

/** What the Gallery is sorted by: when each photo was taken (the default), added, its time of day, color or vividness. */
export type PhotoSort = "taken" | "added" | "time" | "color" | "vivid";

/** Which way a sort runs: "asc" smallest (oldest, earliest, red, least vivid) first, "desc" the other way. */
export type SortOrder = ColorOrder;

/** Each sort, its label, and the way it runs when the URL doesn't say. */
export const SORT_OPTIONS: { sort: PhotoSort; label: string; order: SortOrder }[] = [
  { sort: "taken", label: "Date taken", order: "desc" },
  { sort: "added", label: "Date added", order: "desc" },
  { sort: "time", label: "Time of day", order: "asc" },
  { sort: "color", label: "Color", order: "asc" },
  { sort: "vivid", label: "Vividness", order: "desc" },
];

/** What each sort's two ways are called, ascending then descending. */
export const ORDER_LABELS: Record<PhotoSort, [string, string]> = {
  taken: ["Oldest first", "Newest first"],
  added: ["Oldest first", "Newest first"],
  time: ["Earliest first", "Latest first"],
  color: ["Red to white", "White to red"],
  vivid: ["Least vivid first", "Most vivid first"],
};

/** The sort the URL's `?sort=` names, or date taken for anything else. */
export function parseSort(search: Record<string, unknown>): PhotoSort | undefined {
  return SORT_OPTIONS.find(({ sort }) => sort !== "taken" && sort === search.sort)?.sort;
}

/** The URL's `?order=`, when it's `asc` or `desc`. */
export function parseOrder(search: Record<string, unknown>): SortOrder | undefined {
  return search.order === "asc" || search.order === "desc" ? search.order : undefined;
}

/** The way the sort runs when the URL doesn't say, such as newest first for date taken. */
export function defaultOrder(sort: PhotoSort): SortOrder {
  return SORT_OPTIONS.find((option) => option.sort === sort)?.order ?? "desc";
}

/** A photo's place in a date or time sort; null when it has none, such as no date added. */
const KEYS: Record<"taken" | "added" | "time", (photo: Photo) => number | null> = {
  taken: (photo) => photo.takenAt.getTime(),
  added: (photo) => photo.addedAt?.getTime() ?? null,
  time: minuteOfDay,
};

/** A photo file with the photo the portfolio reads from it, when it has a date. */
interface Sortable {
  path: string;
  photo?: Photo;
}

/** An entry with the photo its sort reads. */
type Placed<T extends Sortable> = T & { photo: Photo };

/** An entry whose colors are saved, which the color and vividness sorts can place. */
type Colored<T extends Sortable> = Placed<T> & {
  photo: { vividness: number; peakVividness: number };
};

function hasKey<T extends Sortable>(
  entry: T,
  key: (photo: Photo) => number | null,
): entry is Placed<T> {
  return entry.photo !== undefined && key(entry.photo) !== null;
}

function isColored<T extends Sortable>(entry: T): entry is Colored<T> {
  const photo = entry.photo;
  return photo !== undefined && photo.palette.length > 0 && photo.vividness !== null;
}

/** The entries by a date or time either way, keeping newest first where they tie. */
function byKey<T extends Sortable>(
  entries: T[],
  key: (photo: Photo) => number | null,
  order: SortOrder,
): T[] {
  const sign = order === "asc" ? 1 : -1;
  const keyOf = (entry: Placed<T>) => key(entry.photo) ?? 0;
  const placed = entries.filter((entry): entry is Placed<T> => hasKey(entry, key));
  return [
    ...placed.toSorted((a, b) => sign * (keyOf(a) - keyOf(b))),
    ...entries.filter((e) => !hasKey(e, key)),
  ];
}

/** The entries by color or vividness, as the portfolio's Color page sorts them. */
function byColor<T extends Sortable>(entries: T[], sort: "color" | "vivid", order: SortOrder): T[] {
  const colored = entries
    .filter((entry): entry is Colored<T> => isColored(entry))
    .map((entry) => ({ ...entry.photo, entry }));
  const spec = { sort, order, secondaryOrder: order, measure: "average" as const };
  const sorted = sortPhotos(colored, spec).map(({ entry }) => entry);
  return [...sorted, ...entries.filter((entry) => !isColored(entry))];
}

/** The entries newest first, then the ones without a date by path. */
function newestFirst<T extends Sortable>(entries: T[]): T[] {
  return byKey(
    entries.toSorted((a, b) => a.path.localeCompare(b.path)),
    KEYS.taken,
    "desc",
  );
}

/**
 * The entries in the Gallery's sort, either way. Photos the sort can't place (no date, no date
 * added, or no colors saved yet) go after the rest, newest first.
 */
export function sortEntries<T extends Sortable>(
  entries: T[],
  sort: PhotoSort,
  order: SortOrder,
): T[] {
  const base = newestFirst(entries);
  if (sort === "color" || sort === "vivid") return byColor(base, sort, order);
  return byKey(base, KEYS[sort], order);
}
