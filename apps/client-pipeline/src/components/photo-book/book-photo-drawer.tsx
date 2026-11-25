import type { ReactNode } from "react";
import { useMemo } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { useAlbumPhotos } from "@/components/photo-book/album-photos";
import {
  BOOK_PHOTO_DRAG_TYPE,
  FROM_PAGE_DRAG_TYPE,
  fromPlace,
} from "@/components/photo-book/page-slot";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import { type PhotoBook, removePhoto } from "@/lib/photo-book";
import { photosInBook } from "@/lib/photo-book-order";

interface BookPhotoDrawerProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  data: CombinedData;
  /** Every photo file but the Undecided ones. */
  photos: SocialPhoto[];
  /** What the drawer says it's for, under its title. */
  help: string;
  /** Puts the photo clicked on a page. */
  onPick: (photo: SocialPhoto) => void;
  onClose: () => void;
  /** The paths of the photos to fade; the ones in the book when left out. */
  dimmed?: Set<string>;
  /** Goes to the next page with a faded photo; left out, faded photos have no button for it. */
  onJump?: (photo: SocialPhoto) => void;
  /** A control for which photos are faded. */
  fadeBy?: ReactNode;
}

/**
 * The photo book's **Photos** drawer, on Photo Pages and in the Book tab's Edit mode: the book's
 * album's photos in the album's order, to drag onto a page's photo places, where a photo dragged
 * from a page can be dropped to take it off.
 */
export function BookPhotoDrawer(props: BookPhotoDrawerProps) {
  const { book, update, data, photos, help, onPick, onClose, dimmed, onJump, fadeBy } = props;
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const inBook = useMemo(() => photosInBook(book), [book]);
  return (
    <PhotoDrawerPanel
      photos={albumPhotos}
      used={inBook}
      dimmed={dimmed ?? inBook}
      onJump={onJump}
      fadeBy={fadeBy}
      onPick={onPick}
      onClose={onClose}
      dragType={BOOK_PHOTO_DRAG_TYPE}
      words={{ help, showUsed: "Show photos already in the book", usedBadge: "In book" }}
      inOrder
      empty={
        book.album
          ? "The album has no photos yet."
          : "Pick the album the book's photos come from, under Photos from, on the Info tab."
      }
      takeOff={{
        fromType: FROM_PAGE_DRAG_TYPE,
        onRemove: (_path, from) => {
          const place = fromPlace(from);
          if (place) update(removePhoto(book, place));
        },
      }}
    />
  );
}
