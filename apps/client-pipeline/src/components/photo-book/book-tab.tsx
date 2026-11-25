import { useState } from "react";
import { BookPreview } from "@/components/photo-book/book-preview";
import { BudgetMeter } from "@/components/photo-book/budget-meter";
import { LowResolutionList } from "@/components/photo-book/low-resolution-list";
import type { PageLook } from "@/components/photo-book/page-actions";
import { usePreviewKeys, usePreviewMode } from "@/components/photo-book/preview-mode";
import { UnitsDrawer } from "@/components/photo-book/units-drawer";
import { UsedPanel } from "@/components/photo-book/used-panel";
import type { PhotoBook } from "@/lib/photo-book";
import {
  type BookUnit,
  addOtherPage,
  addToBook,
  addToBookBefore,
  bookTags,
  bookUnits,
  bookViews,
  moveInBook,
  pageNumbers,
  removePage,
  setUnitTags,
  takeOutOfBook,
  unitsInBook,
  viewOf,
} from "@/lib/photo-book-order";

/**
 * What the preview shows and where it is: the views of the units in the book, one at a time or,
 * in Preview Mode, facing; the one shown; and Preview Mode, which keeps the same pages shown when
 * it's turned on or off.
 */
function useBookPreview(used: BookUnit[]) {
  const [wanted, setAt] = useState(0);
  const preview = usePreviewMode();
  const views = bookViews(used, preview.on);
  const at = Math.min(wanted, Math.max(0, views.length - 1));
  const shown = views[at]?.units ?? [];
  const turnPreview = (on: boolean) => {
    preview.turn(on);
    if (shown[0]) setAt(viewOf(bookViews(used, on), shown[0]));
  };
  const page = (by: -1 | 1) => setAt(Math.min(Math.max(0, at + by), views.length - 1));
  usePreviewKeys(preview.on, () => turnPreview(false), page);
  return { views, at, setAt, shown, preview, turnPreview };
}

interface BookTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
}

/**
 * A book's Book tab: a preview of the book as large as fits with controls under it, Used page
 * spreads beside it with the book's pages and spreads in order, and the drawer along the bottom
 * with every page and spread made for the book to drag in, where other pages are made too.
 * Preview Mode collapses the app's sidebar, Used page spreads and the drawer, and shows the book
 * as it opens, two facing pages at a time.
 */
export function BookTab({ book, update, look }: BookTabProps) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [usedCollapsed, setUsedCollapsed] = useState(false);
  const used = unitsInBook(book);
  const { views, at, setAt, shown, preview, turnPreview } = useBookPreview(used);
  /** Opens or closes a panel, leaving Preview Mode first. */
  const panel = (set: (open: boolean) => void) => (open: boolean) => {
    if (preview.on) turnPreview(false);
    set(open);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <BudgetMeter book={book} />
          <BookPreview
            views={views}
            at={at}
            onAt={setAt}
            look={look}
            numbers={pageNumbers(book)}
            previewMode={preview.on}
            onPreviewMode={turnPreview}
          />
          <LowResolutionList
            book={book}
            photos={look.photos}
            printWidth={look.printWidth}
            onShow={(id) => setAt(viewOf(views, id))}
          />
        </div>
        <UsedPanel
          units={used}
          shown={shown}
          look={look}
          numbers={pageNumbers(book)}
          onShow={(id) => setAt(viewOf(views, id))}
          onPlace={(id, before) => update(addToBookBefore(book, id, before))}
          onMove={(from, to) => update(moveInBook(book, from, to))}
          onTakeOut={(id) => update(takeOutOfBook(book, id))}
          collapsed={preview.on || usedCollapsed}
          onCollapsed={panel(setUsedCollapsed)}
        />
      </div>
      <UnitsDrawer
        units={bookUnits(book)}
        inBook={new Set(used.map((unit) => unit.id))}
        look={look}
        onAdd={(id) => update(addToBook(book, id))}
        onTakeOut={(id) => update(takeOutOfBook(book, id))}
        onAddOther={(name) => update(addOtherPage(book, name))}
        onRemoveOther={(id) =>
          update(
            removePage(
              book,
              book.pages.findIndex((p) => p.id === id),
            ),
          )
        }
        tags={bookTags(book)}
        onTags={(id, tags) => update(setUnitTags(book, id, tags))}
        open={drawerOpen && !preview.on}
        onOpen={panel(setDrawerOpen)}
      />
    </div>
  );
}
