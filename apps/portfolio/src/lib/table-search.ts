import { parseLocationDetail, type LocationDetail } from "@/lib/location-detail";

/** The columns the Grid's Table view can be sorted by, as they're named in the URL. */
const SORTABLE = [
  "title",
  "takenAt",
  "addedAt",
  "location",
  "camera",
  "lens",
  "aperture",
  "exposure",
  "iso",
  "focalLength",
] as const;

/** A column the table can be sorted by. */
export type SortColumn = (typeof SORTABLE)[number];

/** Every column but the title can be hidden; the title is what names each row. */
export const HIDEABLE = ["image", ...SORTABLE.filter((column) => column !== "title")] as const;

/** A column the Columns menu can hide. */
export type HideableColumn = (typeof HIDEABLE)[number];

/** The Grid's Table view's settings in the URL. */
export interface TableSearch {
  /** The column it's sorted by; left out for the default, newest first. */
  column?: SortColumn;
  dir?: "asc" | "desc";
  /** The columns hidden from the Columns menu; left out when every column is shown. */
  hide?: HideableColumn[];
  /** How much of each photo's location the Place column shows; left out for the most specific place. */
  placeDetail?: LocationDetail;
}

/**
 * The Table view's settings from the URL, leaving out any it doesn't know. sortKey names the key
 * holding the sorted column: `column` on the Grid, `sort` in older `/table` links.
 */
export function parseTableSearch(
  search: Record<string, unknown>,
  sortKey: "column" | "sort" = "column",
): TableSearch {
  return { ...parseSort(search, sortKey), ...parseHide(search), ...parsePlaceDetail(search) };
}

/** How much of each location the URL asks the Place column to show, leaving out the default. */
function parsePlaceDetail(search: Record<string, unknown>): TableSearch {
  const placeDetail = parseLocationDetail(search.placeDetail);
  return placeDetail ? { placeDetail } : {};
}

/** The sort the URL asks for, leaving it out when it names no column. */
function parseSort(search: Record<string, unknown>, sortKey: string): TableSearch {
  const column = SORTABLE.find((name) => name === search[sortKey]);
  if (!column) return {};
  return { column, dir: search.dir === "asc" ? "asc" : "desc" };
}

/** The hidden columns the URL names, leaving out any it doesn't know. */
function parseHide(search: Record<string, unknown>): TableSearch {
  const named: unknown[] = Array.isArray(search.hide) ? search.hide : [];
  const hide = HIDEABLE.filter((column) => named.includes(column));
  return hide.length > 0 ? { hide } : {};
}
