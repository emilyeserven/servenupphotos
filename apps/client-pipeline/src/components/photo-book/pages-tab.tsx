import { useMemo } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { AddPageButton } from "@/components/photo-book/add-page-button";
import { useAlbumPhotos } from "@/components/photo-book/album-photos";
import { BookPage } from "@/components/photo-book/book-page";
import { type PageLook, pageActions } from "@/components/photo-book/page-actions";
import { PageControls, UnitControls } from "@/components/photo-book/page-controls";
import {
  BOOK_PHOTO_DRAG_TYPE,
  FROM_PAGE_DRAG_TYPE,
  fromPlace,
} from "@/components/photo-book/page-slot";
import { unitName } from "@/components/photo-book/page-types";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import {
  type PhotoBook,
  firstEmptySlot,
  isOtherPage,
  placePhoto,
  removePhoto,
  renamePage,
  setLayout,
} from "@/lib/photo-book";
import { layoutChoices } from "@/lib/photo-book-layouts";
import {
  type BookUnit,
  addPage,
  bookOrder,
  bookUnits,
  movePhotoUnit,
  pageNumbers,
  photosInBook,
  removePage,
  repeatedPhotos,
  setLinkNext,
} from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";
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
 * A book's Photo Pages tab: every photo page made for it, ones that could be used, in any layout
 * and with any of the album's photos, each named, linked pages shown side by side as spreads, and
 * the drawer of the album's photos beside them.
 */
export function PagesTab({ book, update, look, data, photos, drawer }: PagesTabProps) {
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const inBook = useMemo(() => photosInBook(book), [book]);
  const pick = (photo: SocialPhoto) => {
    const place = firstEmptySlot(book);
    if (place) update(placePhoto(book, place, photo.path));
  };
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <PhotoUnits book={book} update={update} look={look} />
        <div>
          <AddPageButton
            layouts={layoutChoices(book)}
            onAdd={(layout) => update(addPage(book, layout))}
          />
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
      )}
    </div>
  );
}

type UnitsProps = Pick<PagesTabProps, "book" | "update" | "look">;

/** The photo pages, each page or spread with its controls, a spread across the whole row. */
function PhotoUnits({ book, update, look }: UnitsProps) {
  const units = useMemo(
    () => bookUnits(book).filter((unit) => !unit.pages.some(isOtherPage)),
    [book],
  );
  if (units.length === 0) {
    return (
      <EmptyNote>
        No photo pages yet. Add pages in any layout and fill them with the album&apos;s photos, then
        put the ones to use in the book on the Book tab.
      </EmptyNote>
    );
  }
  return (
    <div className="grid gap-x-4 gap-y-8 2xl:grid-cols-2">
      {units.map((unit, place) => (
        <PhotoUnit
          key={unit.id}
          unit={unit}
          place={place}
          next={units[place + 1]}
          book={book}
          update={update}
          look={look}
        />
      ))}
    </div>
  );
}

interface PhotoUnitProps extends UnitsProps {
  unit: BookUnit;
  /** Its place among the photo pages, 0 first. */
  place: number;
  /** The page or spread after it, if there's one. */
  next: BookUnit | undefined;
}

/** One photo page, or a spread's two side by side, with the unit's controls over them. */
function PhotoUnit({ unit, place, next, book, update, look }: PhotoUnitProps) {
  const numbers = pageNumbers(book);
  const repeated = repeatedPhotos(book);
  const spread = unit.pages.length > 1;
  return (
    <div className={cn("flex flex-col gap-2", spread && "2xl:col-span-2")}>
      <UnitControls
        name={unitName(unit)}
        spread={spread}
        inBook={bookOrder(book).includes(unit.id)}
        canLink={next?.pages.length === 1}
        place={place}
        last={next === undefined}
        onLink={(link) => update(setLinkNext(book, unit.id, link))}
        onMove={(from, to) => update(movePhotoUnit(book, from, to > from ? 1 : -1))}
      />
      <div className={cn("grid gap-x-4", spread && "grid-cols-2 gap-x-0.5")}>
        {unit.pages.map((page) => {
          const index = book.pages.indexOf(page);
          const actions = pageActions(book, index, update);
          return (
            <BookPage
              key={page.id}
              page={page}
              index={index}
              number={numbers.get(page.id) ?? null}
              repeated={repeated}
              {...look}
              actions={actions}
              controls={
                <PageControls
                  page={page}
                  layouts={layoutChoices(book)}
                  onName={(name) => update(renamePage(book, index, name))}
                  onLayout={(layout) => update(setLayout(book, index, layout))}
                  onTitle={actions.onTitle}
                  onRemove={() => update(removePage(book, index))}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
}
