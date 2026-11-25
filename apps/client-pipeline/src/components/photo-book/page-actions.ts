import type { SocialPhoto } from "@/api/publish";
import type { useCaptionFor } from "@/components/photo-book/book-captions";
import type { PageActions } from "@/components/photo-book/page-types";
import { type PhotoBook, placePhoto, removePhoto, setCaption, setTitle } from "@/lib/photo-book";

/** What the page itself does to book, through update: its title, photos and captions. */
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
  };
}

/** What every tab draws a page with: the photos by path, each slot's caption, and the page's shape. */
export interface PageLook {
  photos: Map<string, SocialPhoto>;
  captionFor: ReturnType<typeof useCaptionFor>;
  /** The page's width over its height, from the book's size. */
  aspect: number;
}

/** Actions for a page that's only shown, such as a small preview: they do nothing. */
export const NO_ACTIONS: PageActions = {
  onTitle: () => undefined,
  onDropPhoto: () => undefined,
  onRemovePhoto: () => undefined,
  onCaption: () => undefined,
};
