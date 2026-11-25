import type { ReactNode } from "react";
import type { SocialPhoto } from "@/api/publish";
import type { BookPage as Page, SlotPlace } from "@/lib/photo-book";

/** What the page itself can do to its book: its title, photos and captions. */
export interface PageActions {
  onTitle: (title: string | null) => void;
  /** Puts the photo at path in the slot; from is where it was dragged from on the pages, if it was. */
  onDropPhoto: (slot: number, path: string, from: SlotPlace | undefined) => void;
  onRemovePhoto: (slot: number) => void;
  onCaption: (slot: number, caption: string | null) => void;
}

/** A page of the book, where it is, and what it shows and can do. */
export interface BookPageProps {
  page: Page;
  /** The page's place among all the pages that could be used, 0 first. */
  index: number;
  /** Its number in the book; null when it isn't in the book. */
  number: number | null;
  /** For each photo on more than one page in the book, the numbers of those pages. */
  repeated: Map<string, number[]>;
  photos: Map<string, SocialPhoto>;
  captionFor: (slot: Page["slots"][number]) => string;
  actions: PageActions;
  /** The page's width over its height, from the book's size. */
  aspect: number;
  /** The buttons above the page; none on a preview. */
  controls?: ReactNode;
}

/** What a page is called: the name it was given, or "Untitled page". */
export function pageName(page: Page): string {
  return page.name?.trim() || "Untitled page";
}

/** What a page or spread is called: its page's name, or its two pages' names joined. */
export function unitName(unit: { pages: Page[] }): string {
  return unit.pages.map(pageName).join(" + ");
}
