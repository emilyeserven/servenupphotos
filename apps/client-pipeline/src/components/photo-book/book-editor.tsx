import { useMemo, useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { AddPageButton } from "@/components/photo-book/add-page-button";
import { bookAlbums, useAlbumPhotos } from "@/components/photo-book/album-photos";
import { BookSettings, DeleteBookButton } from "@/components/photo-book/book-bar";
import { useBookTemplate, useCaptionFor } from "@/components/photo-book/book-captions";
import { BookPage } from "@/components/photo-book/book-page";
import {
  BOOK_PHOTO_DRAG_TYPE,
  FROM_PAGE_DRAG_TYPE,
  fromPlace,
} from "@/components/photo-book/page-slot";
import type { PageActions } from "@/components/photo-book/page-types";
import { usePhotoBookDraft } from "@/components/photo-book/use-photo-book";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import { SaveState } from "@/components/save-state";
import {
  type PhotoBook,
  addPage,
  firstEmptySlot,
  movePage,
  pageNumbers,
  photosInBook,
  placePhoto,
  removePage,
  removePhoto,
  repeatedPhotos,
  setCaption,
  setLayout,
  setLeftOut,
  setTitle,
} from "@/lib/photo-book";
import { EmptyNote } from "@portfolio/components/empty-note";

/** What the photo drawer says beside the book. */
const BOOK_DRAWER_WORDS = {
  help: "The album's photos, in its order. Drag one onto a page, or click it to fill the first empty place in the book. Drop a photo from a page here to take it off.",
  showUsed: "Show photos already in the book",
  usedBadge: "In book",
};

/** What each page's controls do to book, through update. */
function pageActions(book: PhotoBook, index: number, update: (b: PhotoBook) => void): PageActions {
  return {
    onLayout: (layout) => update(setLayout(book, index, layout)),
    onTitle: (title) => update(setTitle(book, index, title)),
    onMove: (from, to) => update(movePage(book, from, to)),
    onRemove: () => update(removePage(book, index)),
    onLeftOut: (leftOut) => update(setLeftOut(book, index, leftOut)),
    onDropPhoto: (slot, path, from) => update(placePhoto(book, { page: index, slot }, path, from)),
    onRemovePhoto: (slot) => update(removePhoto(book, { page: index, slot })),
    onCaption: (slot, caption) => update(setCaption(book, { page: index, slot }, caption)),
  };
}

interface BookEditorProps {
  saved: PhotoBook;
  /** Every photo file but the Undecided ones, to find the pages' photos in. */
  photos: SocialPhoto[];
  data: CombinedData;
  /** Called once the book is removed. */
  onRemoved: () => void;
}

/**
 * The open book: its name, album and caption template, its pages, and the drawer of its album's
 * photos beside them.
 */
export function BookEditor({ saved, photos, data, onRemoved }: BookEditorProps) {
  const { book, update, error, saving } = usePhotoBookDraft(saved);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const albums = useMemo(() => bookAlbums(data), [data]);
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const { templates, template } = useBookTemplate(book);
  const captionFor = useCaptionFor(byPath, template);
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <BookSettings
            book={book}
            albums={albums}
            templates={templates}
            template={template}
            onChange={update}
          />
          <div className="flex items-center gap-2">
            <SaveState saving={saving} error={error} />
            <DeleteBookButton book={book} onDeleted={onRemoved} />
            <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
          </div>
        </div>
        {book.pages.length === 0 && (
          <EmptyNote>
            No pages yet. Add one in any layout, then fill it with photos from the album.
          </EmptyNote>
        )}
        <div className="grid gap-x-1 gap-y-6 2xl:grid-cols-2">
          {book.pages.map((page, index) => (
            <BookPage
              key={page.id}
              page={page}
              index={index}
              number={numbers[index] ?? null}
              last={index === book.pages.length - 1}
              repeated={repeated}
              photos={byPath}
              captionFor={captionFor}
              actions={pageActions(book, index, update)}
            />
          ))}
        </div>
        <div>
          <AddPageButton onAdd={(layout) => update(addPage(book, layout))} />
        </div>
      </div>
      {drawerOpen && (
        <PhotoDrawerPanel
          photos={albumPhotos}
          used={inBook}
          onPick={pick}
          onClose={() => setDrawerOpen(false)}
          dragType={BOOK_PHOTO_DRAG_TYPE}
          words={BOOK_DRAWER_WORDS}
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
