import type { SocialPhoto } from "@/api/publish";
import type { useCaptionFor, usePartsFor } from "@/components/photo-book/book-captions";
import type { PageActions } from "@/components/photo-book/page-types";
import type { usePlacesIndexFor } from "@/components/photo-book/use-places-index";
import {
  type CustomLayout,
  type PageSide,
  type PhotoBook,
  placePhoto,
  removePhoto,
  setCaption,
  setTitle,
} from "@/lib/photo-book";
import type { PageGuides } from "@/lib/photo-book-guides";
import { setPageText, setPhotoPlaces, setTextColumns, setTextPlace } from "@/lib/photo-book-text";

/** What the page itself does to book, through update: its title, photos and captions, and a text page's text. */
export function pageActions(
  book: PhotoBook,
  index: number,
  update: (b: PhotoBook) => void,
): PageActions {
  return {
    onTitle: (title) => update(setTitle(book, index, title)),
    onDropPhoto: (slot, path, from) => update(placePhoto(book, { page: index, slot }, path, from)),
    onRemovePhoto: (slot) => update(removePhoto(book, { page: index, slot })),
    onCaption: (slot, caption) => update(setCaption(book, { page: index, slot }, caption)),
    onText: (text) => update(setPageText(book, index, text)),
    onColumns: (columns) => update(setTextColumns(book, index, columns)),
    onTextPlace: (place) => update(setTextPlace(book, index, place)),
    onPhotoPlaces: (count) => update(setPhotoPlaces(book, index, count)),
  };
}

/** What every tab draws a page with: the photos by path, each slot's caption, and the page's shape. */
export interface PageLook {
  photos: Map<string, SocialPhoto>;
  captionFor: ReturnType<typeof useCaptionFor>;
  /** The parts of each slot's photo's location, and the lines, its caption can leave out. */
  partsFor: ReturnType<typeof usePartsFor>;
  /** The page's width over its height, from the book's size. */
  aspect: number;
  /** The layouts made on the book's Layouts tab, which pages can have besides the built-in ones. */
  layouts: CustomLayout[];
  /** Which side of the open book each page is on, which sets how a custom layout draws it. */
  sides: Map<string, PageSide>;
  /** The page's printed width in inches, to check its photos' resolution; null for a size in pixels. */
  printWidth: number | null;
  /** True when the book shows no page titles, set on its Info tab. */
  noTitles: boolean;
  /** The Places Index a generated page shows, with its options, from the pages in the book. */
  placesIndexFor: ReturnType<typeof usePlacesIndexFor>;
  /** Blurb's bleed and safe boundary to draw over each page, while **Show bleed and safe boundary** is on; null while it's off. */
  guides: PageGuides | null;
}

/** Actions for a page that's only shown, such as a small preview: they do nothing. */
export const NO_ACTIONS: PageActions = {
  onTitle: () => undefined,
  onDropPhoto: () => undefined,
  onRemovePhoto: () => undefined,
  onCaption: () => undefined,
  onText: () => undefined,
  onColumns: () => undefined,
  onTextPlace: () => undefined,
  onPhotoPlaces: () => undefined,
};
