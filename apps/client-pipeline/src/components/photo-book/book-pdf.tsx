import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDownIcon } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { bookPdfMutation, bookPdfProgressQuery } from "@/api/photo-books";
import { ErrorNote } from "@/components/error-note";
import { BookPage } from "@/components/photo-book/book-page";
import { NO_ACTIONS, type PageLook } from "@/components/photo-book/page-actions";
import { PrintingContext } from "@/components/photo-book/printing";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob } from "@/lib/download-blob";
import type { BookPage as Page, PhotoBook } from "@/lib/photo-book";
import { type BookUnit, isPlaceholder, printedPages } from "@/lib/photo-book-order";
import {
  PRINT_ROOT_ID,
  absoluteSrcSet,
  pdfDocument,
  pdfProgressText,
  printCss,
  printSide,
  printSize,
} from "@/lib/photo-book-pdf";

/** No photo is marked as on another page in the PDF. */
const NOT_REPEATED = new Map<string, number[]>();

/** Waits a moment, for the pages to be measured and pick their photos' versions. */
function settle(): Promise<void> {
  return new Promise((done) => setTimeout(done, 500));
}

/** Every style sheet on this page, as text: the pipeline's Tailwind styles the pages are drawn with. */
function pageStyles(): string {
  return [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        // A style sheet from another site can't be read; the pages don't use one.
        return "";
      }
    })
    .join("\n");
}

/**
 * A copy of the drawn pages for the backend to print: each photo's addresses made whole and set to
 * load at once, since the pages open at another address there.
 */
function pagesHtml(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const img of copy.querySelectorAll("img")) {
    img.setAttribute("src", img.src);
    const srcSet = img.getAttribute("srcset");
    if (srcSet) img.setAttribute("srcset", absoluteSrcSet(srcSet, document.baseURI));
    img.setAttribute("loading", "eager");
  }
  return copy.outerHTML;
}

/** The drawn pages as a whole page for the backend to print, or null when they aren't drawn. */
function drawnPages(): string | null {
  const root = document.getElementById(PRINT_ROOT_ID);
  if (!root) return null;
  return pdfDocument({ styles: pageStyles(), pages: pagesHtml(root), base: document.baseURI });
}

/**
 * Making the book's PDF: start draws the pages out of sight, sends them to the backend once drawn
 * and downloads the PDF it makes; text is the button's words, how far it has got while busy.
 */
function useSavePdf(book: PhotoBook, used: BookUnit[]) {
  const [drawing, setDrawing] = useState(false);
  const pdf = useMutation(bookPdfMutation);
  const progress = useQuery({ ...bookPdfProgressQuery(book.id), enabled: pdf.isPending });
  const start = async () => {
    pdf.reset();
    setDrawing(true);
    await settle();
    const html = drawnPages();
    setDrawing(false);
    if (!html) return;
    const pages = printedPages(used).length;
    pdf.mutate(
      { id: book.id, html, pages },
      { onSuccess: ({ blob }) => downloadBlob(`${book.id}.pdf`, blob) },
    );
  };
  const busy = drawing || pdf.isPending;
  const text = busy ? pdfProgressText(drawing, progress.data) : "Save as PDF";
  return { start, drawing, busy, disabled: busy || used.length === 0, text, error: pdf.error };
}

/**
 * **Save as PDF**: draws every page of the book in its order, each the book's page size, and has
 * the backend print them to a PDF with a headless Chrome, saying how far it has got, then downloads
 * the PDF. Blank pages print blank; the inside covers aren't pages of the book, so they're left out.
 */
export function SavePdfButton(props: { book: PhotoBook; look: PageLook; used: BookUnit[] }) {
  const { start, drawing, busy, disabled, text, error } = useSavePdf(props.book, props.used);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        title="Makes a PDF of every page of the book at its page size, with sharp photos, and downloads it"
        onClick={() => void start()}
      >
        {busy ? <Spinner /> : <FileDownIcon />}
        {text}
      </Button>
      {error && <ErrorNote error={error} className="max-w-sm text-right" />}
      {drawing && createPortal(<PrintBook {...props} />, document.body)}
    </div>
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
