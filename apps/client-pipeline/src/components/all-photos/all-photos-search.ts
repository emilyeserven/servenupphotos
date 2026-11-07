import type { AllPhotosSort, SortOrder } from "@/components/all-photos/all-photos-sort";
import { parseOrder, parseSort } from "@/components/all-photos/all-photos-sort";

/** The All Photos page's search params. */
export interface AllPhotosSearch {
  /** Shows the drafts (photos without a title) too. */
  drafts?: true;
  /** Shows the photos set aside as Undecided too. */
  undecided?: true;
  /** The photo JSON path to scroll to and highlight, which is shown whatever the toggles say. */
  photo?: string;
  /** What the photos are sorted by; date taken when left out. */
  sort?: AllPhotosSort;
  /** Which way the sort runs; its own default when left out. */
  order?: SortOrder;
}

/** The All Photos page's search params from the URL, leaving out anything else. */
export function parseAllPhotosSearch(search: Record<string, unknown>): AllPhotosSearch {
  return {
    drafts: trueOrLeftOut(search.drafts),
    undecided: trueOrLeftOut(search.undecided),
    photo: textOrLeftOut(search.photo),
    sort: parseSort(search),
    order: parseOrder(search),
  };
}

/** true when the param is true, or else left out. */
function trueOrLeftOut(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

/** The param when it's text with something in it, or else left out. */
function textOrLeftOut(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
