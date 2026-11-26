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
  pdfFile,
  pdfProgressText,
  printCss,
  printSide,
  printSize,
  spreadSheets,
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
function useSavePdf({ book, used, spreads = false }: PdfProps) {
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
    const { name, sheets } = pdfFile(book.id, printedPages(used).length, spreads);
    const done = ({ blob }: { blob: Blob }) => downloadBlob(name, blob);
    pdf.mutate({ id: book.id, html, pages: sheets }, { onSuccess: done });
  };
  const busy = drawing || pdf.isPending;
  const { label, title } = pdfFile(book.id, 0, spreads);
  const text = busy ? pdfProgressText(drawing, progress.data) : label;
  return {
    start,
    drawing,
    busy,
    disabled: busy || used.length === 0,
    text,
    title,
    error: pdf.error,
  };
}

interface PdfProps {
  book: PhotoBook;
  look: PageLook;
  used: BookUnit[];
  /** Each two-page spread on one sheet, two pages wide, instead of one page a sheet. */
  spreads?: boolean;
}

/**
 * **Save as PDF**: draws every page of the book in its order, each the book's page size, and has
 * the backend print them to a PDF with a headless Chrome, saying how far it has got, then downloads
 * the PDF. Blank pages print blank; the inside covers aren't pages of the book, so they're left out.
 * With spreads, **Save spreads as PDF**: each spread is one sheet, page 1 and a last left page with
 * a blank half where the inside cover is.
 */
export function SavePdfButton(props: PdfProps) {
  const { start, drawing, busy, disabled, text, title, error } = useSavePdf(props);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        title={title}
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

/** The book's pages as printed, one sheet of paper each or two a sheet, out of sight on the screen. */
function PrintBook({ book, look, used, spreads = false }: PdfProps) {
  const { width, height } = printSize(book, spreads);
  const pages = printedPages(used);
  return (
    <PrintingContext.Provider value>
      <div
        id={PRINT_ROOT_ID}
        inert
        data-preview
        data-print
        style={{ width, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <style>{printCss(book, spreads)}</style>
        {spreads ? (
          <PrintSpreads book={book} look={look} pages={pages} />
        ) : (
          pages.map((page, i) => (
            <div key={page.id} style={{ width, height, breakAfter: "page", overflow: "hidden" }}>
              <PrintPage page={page} look={look} at={i} />
            </div>
          ))
        )}
      </div>
    </PrintingContext.Provider>
  );
}

/** The pages two to a sheet, as the open book shows them, a missing half left blank. */
function PrintSpreads({ book, look, pages }: { book: PhotoBook; look: PageLook; pages: Page[] }) {
  const page = printSize(book);
  const sheet = printSize(book, true);
  return spreadSheets(pages.length).map((halves) => (
    <div
      key={halves.join("-")}
      style={{ ...sheet, display: "flex", breakAfter: "page", overflow: "hidden" }}
    >
      {halves.map((at, i) => (
        <div key={i} style={{ ...page, flex: "none", overflow: "hidden" }}>
          {at !== null && pages[at] && <PrintPage page={pages[at]} look={look} at={at} />}
        </div>
      ))}
    </div>
  ));
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
