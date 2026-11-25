import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { BookPhotoDrawer } from "@/components/photo-book/book-photo-drawer";
import { BookPreview } from "@/components/photo-book/book-preview";
import { BudgetMeter } from "@/components/photo-book/budget-meter";
import { LowResolutionList } from "@/components/photo-book/low-resolution-list";
import type { PageLook } from "@/components/photo-book/page-actions";
import { usePreviewKeys, usePreviewMode } from "@/components/photo-book/preview-mode";
import { UnitsDrawer } from "@/components/photo-book/units-drawer";
import { UsedPanel } from "@/components/photo-book/used-panel";
import { type PageLayout, type PhotoBook, placePhoto } from "@/lib/photo-book";
import { firstEmptySlotOn, insertNewPage, insertPoints } from "@/lib/photo-book-edit";
import { unitLayouts } from "@/lib/photo-book-layout-filter";
import { layoutChoices } from "@/lib/photo-book-layouts";
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
  printedPages,
  removePage,
  takeOutOfBook,
  unitsInBook,
  viewOf,
} from "@/lib/photo-book-order";

/**
 * What the preview shows and where it is: the book as it opens, two facing pages at a time; the
 * view shown; and Preview Mode.
 */
function useBookPreview(used: BookUnit[]) {
  const [wanted, setAt] = useState(0);
  const preview = usePreviewMode();
  const views = bookViews(used);
  const at = Math.min(wanted, Math.max(0, views.length - 1));
  const shown = views[at]?.units ?? [];
  const turnPreview = (on: boolean) => preview.turn(on);
  const page = (by: -1 | 1) => setAt(Math.min(Math.max(0, at + by), views.length - 1));
  usePreviewKeys(preview.on, () => turnPreview(false), page);
  return { views, at, setAt, shown, preview, turnPreview };
}

interface BookTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
  data: CombinedData;
  /** Every photo file but the Undecided ones, for Edit mode's Photos drawer. */
  photos: SocialPhoto[];
}

/** What Edit mode's Photos drawer says it is for. */
const EDIT_DRAWER_HELP =
  "The album's photos, in its order; ones already in the book are faded. Drag one onto a photo on the pages shown to put it in that photo's place, or click it to fill the first empty place there. Drop a photo from the pages here to take it off.";

/**
 * Edit mode on the preview: whether it's on, inserting a page on the pages shown (then showing the
 * new page), and the Photos drawer it shows in place of Used page spreads.
 */
function useEditMode(
  props: BookTabProps,
  preview: ReturnType<typeof useBookPreview>,
  used: BookUnit[],
) {
  const { book, update, data, photos } = props;
  const [on, setOn] = useState(false);
  const view = preview.views[preview.at];
  const inserting = {
    points: view ? insertPoints(view, used) : [],
    layouts: layoutChoices(book),
    onInsert: (layout: PageLayout, at: number) => {
      const added = insertNewPage(book, layout, at);
      update(added.book);
      preview.setAt(viewOf(bookViews(unitsInBook(added.book)), added.id));
    },
  };
  const drawer = (
    <BookPhotoDrawer
      book={book}
      update={update}
      data={data}
      photos={photos}
      help={EDIT_DRAWER_HELP}
      onPick={(photo) => {
        const place = firstEmptySlotOn(book, view?.pages.map((page) => page.id) ?? []);
        if (place) update(placePhoto(book, place, photo.path));
      }}
      onClose={() => setOn(false)}
    />
  );
  return { on, setOn, inserting, drawer };
}

/**
 * A book's Book tab: a preview of the book as large as fits with controls under it, Used page
 * spreads beside it with the book's pages and spreads in order, and the drawer along the bottom
 * with every page and spread made for the book to drag in, where other pages are made too.
 * Preview Mode collapses the app's sidebar, Used page spreads and the drawer, and shows the book
 * as it opens, two facing pages at a time.
 */
export function BookTab(props: BookTabProps) {
  const { book, update, look } = props;
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [usedCollapsed, setUsedCollapsed] = useState(false);
  const used = unitsInBook(book);
  const bookPreview = useBookPreview(used);
  const { views, at, setAt, preview, turnPreview } = bookPreview;
  const edit = useEditMode(props, bookPreview, used);
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
            total={printedPages(used).length}
            previewMode={preview.on}
            onPreviewMode={turnPreview}
            book={book}
            update={update}
            editMode={edit.on}
            onEditMode={edit.setOn}
            inserting={edit.inserting}
          />
          <LowResolutionList
            book={book}
            photos={look.photos}
            printWidth={look.printWidth}
            onShow={(id) => setAt(viewOf(views, id))}
          />
        </div>
        {edit.on && !preview.on ? (
          edit.drawer
        ) : (
          <BookUsedPanel
            {...props}
            used={used}
            preview={bookPreview}
            collapsed={usedCollapsed}
            onCollapsed={panel(setUsedCollapsed)}
          />
        )}
      </div>
      <BookUnitsDrawer
        {...props}
        used={used}
        open={drawerOpen && !preview.on}
        onOpen={panel(setDrawerOpen)}
      />
    </div>
  );
}

/** Used page spreads, beside the preview: the book's pages and spreads in order. */
function BookUsedPanel(
  props: BookTabProps & {
    used: BookUnit[];
    preview: ReturnType<typeof useBookPreview>;
    collapsed: boolean;
    onCollapsed: (collapsed: boolean) => void;
  },
) {
  const { book, update, look, used, preview, collapsed, onCollapsed } = props;
  return (
    <UsedPanel
      units={used}
      shown={preview.shown}
      look={look}
      numbers={pageNumbers(book)}
      onShow={(id) => preview.setAt(viewOf(preview.views, id))}
      onPlace={(id, before) => update(addToBookBefore(book, id, before))}
      onMove={(from, to) => update(moveInBook(book, from, to))}
      onTakeOut={(id) => update(takeOutOfBook(book, id))}
      collapsed={preview.preview.on || collapsed}
      onCollapsed={onCollapsed}
    />
  );
}

/** The drawer along the bottom with every page and spread made for the book. */
function BookUnitsDrawer(
  props: BookTabProps & { used: BookUnit[]; open: boolean; onOpen: (open: boolean) => void },
) {
  const { book, update, look, used, open, onOpen } = props;
  return (
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
      layouts={unitLayouts(book, bookUnits(book))}
      open={open}
      onOpen={onOpen}
    />
  );
}
