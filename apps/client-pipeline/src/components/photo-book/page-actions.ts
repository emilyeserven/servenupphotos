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

/** What both tabs draw a page with: the photos by path and each slot's caption. */
export interface PageLook {
  photos: Map<string, SocialPhoto>;
  captionFor: ReturnType<typeof useCaptionFor>;
}
