import type { SocialPhoto } from "@/api/publish";
import type { BookPage as Page, PageLayout, SlotPlace } from "@/lib/photo-book";

/** What a page can do to the book it's in. */
export interface PageActions {
  onLayout: (layout: PageLayout) => void;
  onTitle: (title: string | null) => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  /** Leaves the page out of the book, or puts it back in when leftOut is false. */
  onLeftOut: (leftOut: boolean) => void;
  /** Puts the photo at path in the slot; from is where it was dragged from on the pages, if it was. */
  onDropPhoto: (slot: number, path: string, from: SlotPlace | undefined) => void;
  onRemovePhoto: (slot: number) => void;
  onCaption: (slot: number, caption: string | null) => void;
}

/** A page of the book, where it is, and what it shows and can do. */
export interface BookPageProps {
  page: Page;
  /** The page's place among the pages, 0 first. */
  index: number;
  /** Its number in the book; null when it's left out. */
  number: number | null;
  last: boolean;
  /** For each photo on more than one page in the book, the numbers of those pages. */
  repeated: Map<string, number[]>;
  photos: Map<string, SocialPhoto>;
  captionFor: (slot: Page["slots"][number]) => string;
  actions: PageActions;
}

/** What a page is called: "Page 3", or "Left out" with no number. */
export function pageName(number: number | null): string {
  return number === null ? "Left out" : `Page ${number}`;
}
