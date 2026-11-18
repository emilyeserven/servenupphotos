import type { GalleryFile, PhotoKind } from "@/components/gallery/gallery-files";
import type { PhotoSort, SortOrder } from "@/components/gallery/photo-sort";
import { parseOrder, parseSort } from "@/components/gallery/photo-sort";

/** The Gallery's search params for which photos it shows, the photo it points to, and its sort. */
export interface ShowSearch {
  /** Hides the published photos, which are shown when left out. */
  published?: false;
  /** Shows the drafts (photos without a title) too. */
  drafts?: true;
  /** Shows the photos set aside as Undecided too. */
  undecided?: true;
  /** Shows the Lower Tier photos too. */
  lowerTier?: true;
  /** The photo JSON path to scroll to and ring, which is shown whatever the Show group says. */
  photo?: string;
  /** What the photos are sorted by; date taken when left out. */
  sort?: PhotoSort;
  /** Which way the sort runs; its own default when left out. */
  order?: SortOrder;
}

/** The search params `ShowSearch` reads, which Clear filters clears (but not the sort). */
export const SHOW_PARAMS = ["published", "drafts", "undecided", "lowerTier", "photo"];

/**
 * Whether a Show param is on: `true`, or `"show"` and `"only"` from links made before the Gallery
 * and All Photos were one page.
 */
function isOn(value: unknown): true | undefined {
  return value === true || value === "show" || value === "only" ? true : undefined;
}

/** `false` when the published photos are hidden, including by an old `"only"` link. */
function publishedParam(search: Record<string, unknown>): false | undefined {
  const only = search.undecided === "only" || search.lowerTier === "only";
  return search.published === false || only ? false : undefined;
}

/** The param when it's text with something in it, or else left out. */
function textOrLeftOut(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** The Gallery's Show, photo and sort params from the URL, leaving out anything else. */
export function parseShowSearch(search: Record<string, unknown>): ShowSearch {
  return {
    published: publishedParam(search),
    drafts: isOn(search.drafts),
    undecided: isOn(search.undecided),
    lowerTier: isOn(search.lowerTier),
    photo: textOrLeftOut(search.photo),
    sort: parseSort(search),
    order: parseOrder(search),
  };
}

/** Whether each Show group is on in the search. */
export function shownKinds(search: ShowSearch): Record<PhotoKind, boolean> {
  return {
    published: search.published !== false,
    draft: search.drafts === true,
    undecided: search.undecided === true,
    lowerTier: search.lowerTier === true,
  };
}

/** The files of the Show groups that are on, and the photo `?photo=` names whatever its group. */
export function applyShow<T extends Pick<GalleryFile, "path" | "kind">>(
  files: T[],
  search: ShowSearch,
): T[] {
  const kinds = shownKinds(search);
  return files.filter((file) => kinds[file.kind] || file.path === search.photo);
}

/** Whether the search hides a Show group that's shown at first, or shows one that's hidden. */
export function showChanged(search: ShowSearch): boolean {
  return SHOW_PARAMS.some((param) => search[param as keyof ShowSearch] !== undefined);
}
