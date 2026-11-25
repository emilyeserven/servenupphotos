import type { ReactNode } from "react";
import type { SocialPhoto } from "@/api/publish";
import type { SlotShape } from "@/components/photo-book/page-slot";
import type { CustomLayout, BookPage as Page, PageSide, SlotPlace } from "@/lib/photo-book";

/** What the page itself can do to its book: its title, photos and captions, and a text page's text. */
export interface PageActions {
  onTitle: (title: string | null) => void;
  /** Puts the photo at path in the slot; from is where it was dragged from on the pages, if it was. */
  onDropPhoto: (slot: number, path: string, from: SlotPlace | undefined) => void;
  onRemovePhoto: (slot: number) => void;
  onCaption: (slot: number, caption: string | null) => void;
  /** Sets a text page's text, in Markdown. */
  onText: (text: string) => void;
  /** Sets how many columns a text page's text flows into. */
  onColumns: (columns: number) => void;
  /** Sets how many photo places a text page has. */
  onPhotoPlaces: (count: number) => void;
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
  /** The layouts made on the book's Layouts tab, which pages can have besides the built-in ones. */
  layouts: CustomLayout[];
  /** Which side of the open book each page is on, which sets how a custom layout draws it. */
  sides: Map<string, PageSide>;
  /** The page's printed width in inches, to check its photos' resolution; null for a size in pixels. */
  printWidth: number | null;
  /** True when the book shows no page titles, set on its Info tab. */
  noTitles?: boolean;
  /** The side to draw the page on, over the one sides gives, such as in a spread shown on its own. */
  side?: PageSide;
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

/** Draws the page's photo places and captions, by their place on the page, and its title. */
export interface PageParts {
  /** The page's title, typed on the page; nothing for a page without one. */
  title: ReactNode;
  slot: (i: number, shape: SlotShape, className?: string) => ReactNode;
  caption: (i: number, className?: string) => ReactNode;
}
