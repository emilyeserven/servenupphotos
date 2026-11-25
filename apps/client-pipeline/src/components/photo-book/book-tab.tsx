import { useMemo } from "react";
import { BookPage } from "@/components/photo-book/book-page";
import { type PageLook, pageActions } from "@/components/photo-book/page-actions";
import { OrderControls, SpareControls } from "@/components/photo-book/page-controls";
import { SectionTitle } from "@/components/section-title";
import {
  type PhotoBook,
  addToBook,
  bookOrder,
  moveInBook,
  repeatedPhotos,
  takeOutOfBook,
} from "@/lib/photo-book";
import { EmptyNote } from "@portfolio/components/empty-note";

interface BookTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
}

/**
 * A book's Book tab: the pages that will be used, numbered in the book's order, two to a row like
 * spreads, with arrows to move each and a button to take it out; then the pages made on the Pages
 * tab that aren't in the book, each with **Add to book**.
 */
export function BookTab({ book, update, look }: BookTabProps) {
  const order = bookOrder(book);
  const repeated = useMemo(() => repeatedPhotos(book), [book]);
  const indexOf = new Map(book.pages.map((page, i) => [page.id, i]));
  const spare = book.pages.filter((page) => !order.includes(page.id));
  const draw = (id: string, number: number | null, controls: React.ReactNode) => {
    const index = indexOf.get(id) ?? -1;
    const page = book.pages[index];
    if (!page) return null;
    return (
      <BookPage
        key={id}
        page={page}
        index={index}
        number={number}
        repeated={repeated}
        {...look}
        actions={pageActions(book, index, update)}
        controls={controls}
      />
    );
  };
  return (
    <div className="flex flex-col gap-6">
      {order.length === 0 && (
        <EmptyNote>
          No pages in the book yet. Add the pages to use from the ones below, or make some on the
          Pages tab.
        </EmptyNote>
      )}
      <div className="grid gap-x-1 gap-y-6 lg:grid-cols-2">
        {order.map((id, i) =>
          draw(
            id,
            i + 1,
            <OrderControls
              number={i + 1}
              last={i === order.length - 1}
              onMove={(from, to) => update(moveInBook(book, from, to))}
              onTakeOut={() => update(takeOutOfBook(book, id))}
            />,
          ),
        )}
      </div>
      {spare.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle as="h2" size="lg">
            Pages not in the book
          </SectionTitle>
          <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {spare.map((page) =>
              draw(
                page.id,
                null,
                <SpareControls
                  index={indexOf.get(page.id) ?? 0}
                  onAdd={() => update(addToBook(book, page.id))}
                />,
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
