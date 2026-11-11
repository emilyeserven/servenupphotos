import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { photoBooks } from "@/api/photo-books";
import type { SocialPhoto } from "@/api/publish";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { AddPageButton } from "@/components/photo-book/add-page-button";
import { BookChooser, BookSettings } from "@/components/photo-book/book-bar";
import { useBookTemplate, useCaptionFor } from "@/components/photo-book/book-captions";
import { BookPage, type PageActions } from "@/components/photo-book/book-page";
import { BOOK_PHOTO_DRAG_TYPE, FROM_PAGE_DRAG_TYPE } from "@/components/photo-book/page-slot";
import { usePhotoBookDraft } from "@/components/photo-book/use-photo-book";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { SaveState } from "@/components/save-state";
import {
  type PhotoBook,
  addPage,
  firstEmptySlot,
  movePage,
  photosInBook,
  placePhoto,
  removePage,
  removePhoto,
  setCaption,
  setLayout,
  setTitle,
} from "@/lib/photo-book";
import { useCombinedData } from "@/stores/combined-data";

/** What the photo drawer says beside the book. */
const BOOK_DRAWER_WORDS = {
  help: "Drag a photo onto a page, or click it to fill the first empty place. Drop a photo from a page here to take it out of the book.",
  showUsed: "Show photos already in the book",
  usedBadge: "In book",
};

/** The Photo Book page's content: the books, once the photo files are read. */
export function PhotoBookPlanner() {
  return <DecidedPhotoFiles>{(photos) => <Books photos={photos} />}</DecidedPhotoFiles>;
}

/** The book chosen in the address (`?book=`), or else the first one. */
function useChosenBook(books: PhotoBook[]) {
  const search = useSearch({ strict: false }) as { book?: string };
  const navigate = useNavigate();
  const chosen = books.find((b) => b.id === search.book) ?? books[0];
  const choose = (id: string | undefined) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, book: id }),
      resetScroll: false,
    });
  return { chosen, choose };
}

function Books({ photos }: { photos: SocialPhoto[] }) {
  const { data, isPending } = useCombinedData();
  const books = photoBooks(data);
  const { chosen, choose } = useChosenBook(books);
  if (isPending) return <p>Reading the photo books…</p>;
  return (
    <div className="flex flex-col gap-4">
      <BookChooser
        key={books.length === 0 ? "none" : "some"}
        books={books}
        chosen={chosen}
        onChoose={choose}
      />
      {chosen && <BookEditor key={chosen.id} saved={chosen} photos={photos} />}
    </div>
  );
}

/** What each page's controls do to book, through update. */
function pageActions(book: PhotoBook, index: number, update: (b: PhotoBook) => void): PageActions {
  return {
    onLayout: (layout) => update(setLayout(book, index, layout)),
    onTitle: (title) => update(setTitle(book, index, title)),
    onMove: (from, to) => update(movePage(book, from, to)),
    onRemove: () => update(removePage(book, index)),
    onDropPhoto: (slot, path) => update(placePhoto(book, { page: index, slot }, path)),
    onRemovePhoto: (path) => update(removePhoto(book, path)),
    onCaption: (slot, caption) => update(setCaption(book, { page: index, slot }, caption)),
  };
}

/** The open book: its name and caption template, its pages, and the photo drawer beside them. */
function BookEditor({ saved, photos }: { saved: PhotoBook; photos: SocialPhoto[] }) {
  const { book, update, error, saving } = usePhotoBookDraft(saved);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const { templates, template } = useBookTemplate(book);
  const captionFor = useCaptionFor(byPath, template);
  const inBook = useMemo(() => photosInBook(book), [book]);
  const pick = (photo: SocialPhoto) => {
    const place = firstEmptySlot(book);
    if (place) update(placePhoto(book, place, photo.path));
  };
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <BookSettings book={book} templates={templates} template={template} onChange={update} />
          <div className="flex items-center gap-2">
            <SaveState saving={saving} error={error} />
            <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
          </div>
        </div>
        {book.pages.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No pages yet. Add one to start laying out the book.
          </p>
        )}
        <div className="grid gap-x-1 gap-y-6 2xl:grid-cols-2">
          {book.pages.map((page, index) => (
            <BookPage
              key={page.id}
              page={page}
              index={index}
              last={index === book.pages.length - 1}
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
          photos={photos}
          used={inBook}
          onPick={pick}
          onClose={() => setDrawerOpen(false)}
          dragType={BOOK_PHOTO_DRAG_TYPE}
          words={BOOK_DRAWER_WORDS}
          takeOff={{
            fromType: FROM_PAGE_DRAG_TYPE,
            onRemove: (path) => update(removePhoto(book, path)),
          }}
        />
      )}
    </div>
  );
}
