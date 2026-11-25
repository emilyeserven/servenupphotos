import { FileDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookPage } from "@/components/photo-book/book-page";
import { NO_ACTIONS, type PageLook } from "@/components/photo-book/page-actions";
import { PrintingContext } from "@/components/photo-book/printing";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { BookPage as Page, PhotoBook } from "@/lib/photo-book";
import { type BookUnit, isPlaceholder, printedPages } from "@/lib/photo-book-order";
import { PRINT_ROOT_ID, printCss, printSide, printSize } from "@/lib/photo-book-pdf";

/** No photo is marked as on another page in the PDF. */
const NOT_REPEATED = new Map<string, number[]>();

/** The longest **Save as PDF** waits for the photos to load before opening the print dialog anyway. */
const LONGEST_WAIT_MS = 30_000;

/** Waits until every photo in the element has loaded or failed. */
function photosLoaded(root: HTMLElement): Promise<unknown> {
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  return Promise.all(
    pending.map(
      (img) =>
        new Promise((done) => {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

/** Waits a moment, for the pages to be measured and pick their photos' versions. */
function settle(): Promise<void> {
  return new Promise((done) => setTimeout(done, 500));
}

/**
 * Opens the print dialog once the PDF's pages and their photos are ready, and turns printing off
 * with setOn when it closes.
 */
function usePrintWhenReady(on: boolean, setOn: (on: boolean) => void) {
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const onDone = () => setOn(false);
    window.addEventListener("afterprint", onDone, { once: true });
    const ready = async () => {
      await settle();
      const root = document.getElementById(PRINT_ROOT_ID);
      if (root) {
        const timeout = new Promise((done) => setTimeout(done, LONGEST_WAIT_MS));
        await Promise.race([photosLoaded(root), timeout]);
      }
      if (!cancelled) window.print();
    };
    void ready();
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", onDone);
    };
  }, [on, setOn]);
}

/**
 * **Save as PDF**: draws every page of the book in its order, each on a sheet of paper the book's
 * page size, and opens the browser's print dialog, where **Save as PDF** makes the file. Blank
 * pages print blank; the inside covers aren't pages of the book, so they're left out.
 */
export function SavePdfButton(props: { book: PhotoBook; look: PageLook; used: BookUnit[] }) {
  const [printing, setPrinting] = useState(false);
  usePrintWhenReady(printing, setPrinting);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={printing || props.used.length === 0}
        title="Opens the print dialog with every page of the book at its page size; pick Save as PDF there"
        onClick={() => setPrinting(true)}
      >
        {printing ? <Spinner /> : <FileDownIcon />}
        Save as PDF
      </Button>
      {printing && createPortal(<PrintBook {...props} />, document.body)}
    </>
  );
}

/** The book's pages as printed, one sheet of paper each, out of sight on the screen. */
function PrintBook({ book, look, used }: { book: PhotoBook; look: PageLook; used: BookUnit[] }) {
  const { width, height } = printSize(book);
  return (
    <PrintingContext.Provider value>
      <div
        id={PRINT_ROOT_ID}
        inert
        data-preview
        data-print
        style={{ width, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <style>{printCss(book)}</style>
        {printedPages(used).map((page, i) => (
          <div key={page.id} style={{ width, height, breakAfter: "page", overflow: "hidden" }}>
            <PrintPage page={page} look={look} at={i} />
          </div>
        ))}
      </div>
    </PrintingContext.Provider>
  );
}

/** One printed page: nothing for a blank page, or the page as the book draws it. */
function PrintPage({ page, look, at }: { page: Page; look: PageLook; at: number }) {
  if (isPlaceholder(page)) return null;
  return (
    <BookPage
      page={page}
      index={-1}
      number={null}
      repeated={NOT_REPEATED}
      {...look}
      side={printSide(at)}
      actions={NO_ACTIONS}
    />
  );
}
