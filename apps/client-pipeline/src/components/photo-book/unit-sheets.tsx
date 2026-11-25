import { BookPage } from "@/components/photo-book/book-page";
import { NO_ACTIONS, type PageLook, pageActions } from "@/components/photo-book/page-actions";
import type { PageActions } from "@/components/photo-book/page-types";
import type { BookPage as Page, PageSide, PhotoBook } from "@/lib/photo-book";
import { isInsideCover, isPlaceholder } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";

/** No photo is marked as on another page in a preview. */
const NOT_REPEATED = new Map<string, number[]>();

/** The book and its update, to let photos be dragged between the pages shown. */
interface SheetsEditing {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
}

/**
 * Pages side by side as the book shows them, left first: a page, a spread, or two facing pages.
 * Fills its width, keeping the pages' shape. They're only to look at, unless editing is given:
 * then a photo can be dragged to another place on them, moving or swapping it, and nothing else
 * can be changed (titles, captions and the buttons on photos don't respond).
 */
export function UnitSheets(props: {
  pages: Page[];
  look: PageLook;
  className?: string;
  editing?: SheetsEditing;
}) {
  const { pages, look, className, editing } = props;
  return (
    <div
      inert={!editing}
      data-preview
      className={cn(
        "grid",
        editing &&
          "[&_button]:pointer-events-none [&_input]:pointer-events-none [&_textarea]:pointer-events-none",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}
    >
      {pages.map((page, i) => (
        <Sheet
          key={page.id}
          page={page}
          look={look}
          side={pages.length > 1 ? sideAt(i) : undefined}
          editing={editing}
        />
      ))}
    </div>
  );
}

/** The side of the open book the page at place i of two facing pages is on. */
function sideAt(i: number): PageSide {
  return i === 0 ? "left" : "right";
}

/** One page of the sheets: a placeholder, or a book page that only shows, or only takes photos moved. */
function Sheet(props: {
  page: Page;
  look: PageLook;
  side: PageSide | undefined;
  editing: SheetsEditing | undefined;
}) {
  const { page, look, side, editing } = props;
  if (isPlaceholder(page)) return <PlaceholderSheet page={page} aspect={look.aspect} />;
  return (
    <BookPage
      page={page}
      index={editing ? editing.book.pages.indexOf(page) : -1}
      number={null}
      repeated={NOT_REPEATED}
      {...look}
      side={side}
      actions={editing ? moveOnly(editing, page) : NO_ACTIONS}
    />
  );
}

/** The width over the height of pages side by side. */
export function sheetsAspect(pages: Page[], look: PageLook): number {
  return look.aspect * Math.max(1, pages.length);
}

/**
 * A page the Book tab adds, not one made for the book: a blank page, striped and dashed so it
 * reads as a placeholder, or an inside cover, plain grey.
 */
function PlaceholderSheet({ page, aspect }: { page: Page; aspect: number }) {
  const cover = isInsideCover(page);
  return (
    <div
      style={{ aspectRatio: aspect }}
      className={cn(
        "text-muted-foreground flex items-center justify-center p-2 text-center text-[10px] sm:text-xs",
        cover
          ? "bg-muted/60"
          : "border-muted-foreground/50 border-2 border-dashed bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(127_127_127/0.12)_10px_20px)]",
      )}
    >
      {cover ? page.name : `${page.name} · placeholder`}
    </div>
  );
}

/** What a page does while editing: only taking a photo dropped on it, moved or swapped from another place. */
function moveOnly({ book, update }: SheetsEditing, page: Page): PageActions {
  const index = book.pages.indexOf(page);
  return { ...NO_ACTIONS, onDropPhoto: pageActions(book, index, update).onDropPhoto };
}
