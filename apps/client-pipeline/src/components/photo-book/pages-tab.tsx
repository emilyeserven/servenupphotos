import { useMemo } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { AddPageButton } from "@/components/photo-book/add-page-button";
import { useAlbumPhotos } from "@/components/photo-book/album-photos";
import { BookPage } from "@/components/photo-book/book-page";
import { type PageLook, pageActions } from "@/components/photo-book/page-actions";
import { WorkshopControls } from "@/components/photo-book/page-controls";
import {
  BOOK_PHOTO_DRAG_TYPE,
  FROM_PAGE_DRAG_TYPE,
  fromPlace,
} from "@/components/photo-book/page-slot";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import {
  type PhotoBook,
  addPage,
  addToBook,
  firstEmptySlot,
  pageNumbers,
  photosInBook,
  placePhoto,
  removePage,
  removePhoto,
  repeatedPhotos,
  setLayout,
  takeOutOfBook,
} from "@/lib/photo-book";
import { EmptyNote } from "@portfolio/components/empty-note";

/** What the photo drawer says beside the pages. */
const DRAWER_WORDS = {
  help: "The album's photos, in its order. Drag one onto a page, or click it to fill the first empty place. Drop a photo from a page here to take it off.",
  showUsed: "Show photos already in the book",
  usedBadge: "In book",
};

interface PagesTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
  data: CombinedData;
  /** Every photo file but the Undecided ones. */
  photos: SocialPhoto[];
  /** Closes the photo drawer; left out while it's closed. */
  drawer: (() => void) | undefined;
}

/**
 * A book's Pages tab: every page made for it, ones that could be used, in any layout and with any
 * of the album's photos, each with a button that adds it to the book or takes it out, and the
 * drawer of the album's photos beside them.
 */
export function PagesTab({ book, update, look, data, photos, drawer }: PagesTabProps) {
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const inBook = useMemo(() => photosInBook(book), [book]);
  const numbers = useMemo(() => pageNumbers(book), [book]);
  const repeated = useMemo(() => repeatedPhotos(book), [book]);
  const pick = (photo: SocialPhoto) => {
    const place = firstEmptySlot(book);
    if (place) update(placePhoto(book, place, photo.path));
  };
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {book.pages.length === 0 && (
          <EmptyNote>
            No pages yet. Add pages in any layout and fill them with the album's photos, then add
            the ones to use to the book.
          </EmptyNote>
        )}
        <div className="grid gap-x-3 gap-y-6 2xl:grid-cols-2">
          {book.pages.map((page, index) => {
            const number = numbers.get(page.id) ?? null;
            return (
              <BookPage
                key={page.id}
                page={page}
                index={index}
                number={number}
                repeated={repeated}
                {...look}
                actions={pageActions(book, index, update)}
                controls={
                  <WorkshopControls
                    page={page}
                    index={index}
                    number={number}
                    onLayout={(layout) => update(setLayout(book, index, layout))}
                    onTitle={(title) => pageActions(book, index, update).onTitle(title)}
                    onBook={(add) =>
                      update(add ? addToBook(book, page.id) : takeOutOfBook(book, page.id))
                    }
                    onRemove={() => update(removePage(book, index))}
                  />
                }
              />
            );
          })}
        </div>
        <div>
          <AddPageButton onAdd={(layout) => update(addPage(book, layout))} />
        </div>
      </div>
      {drawer && (
        <PhotoDrawerPanel
          photos={albumPhotos}
          used={inBook}
          onPick={pick}
          onClose={drawer}
          dragType={BOOK_PHOTO_DRAG_TYPE}
          words={DRAWER_WORDS}
          inOrder
          empty={
            book.album
              ? "The album has no photos yet."
              : "Pick the album the book's photos come from, under Photos from."
          }
          takeOff={{
            fromType: FROM_PAGE_DRAG_TYPE,
            onRemove: (_path, from) => {
              const place = fromPlace(from);
              if (place) update(removePhoto(book, place));
            },
          }}
        />
      )}
    </div>
  );
}
