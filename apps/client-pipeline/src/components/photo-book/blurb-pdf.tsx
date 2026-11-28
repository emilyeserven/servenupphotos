import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { bookPdfMutation, bookPdfProgressQuery } from "@/api/photo-books";
import { CoverSheet } from "@/components/photo-book/book-cover";
import { PdfButton, PrintBook, drawnPages, settle } from "@/components/photo-book/book-pdf";
import type { PageLook } from "@/components/photo-book/page-actions";
import { downloadBlob } from "@/lib/download-blob";
import type { PhotoBook } from "@/lib/photo-book";
import { type BlurbPdf, blurbOf, blurbPdfs, coverOf } from "@/lib/photo-book-cover";
import { type BookUnit, printedPages } from "@/lib/photo-book-order";
import { PRINT_ROOT_ID, pdfProgressText, sheetCss } from "@/lib/photo-book-pdf";

/** Which PDF is being drawn out of sight: the pages or the cover. */
type Drawing = BlurbPdf["draw"] | null;

interface BlurbPdfProps {
  book: PhotoBook;
  look: PageLook;
  used: BookUnit[];
  /** Makes only the cover's PDF, as the Cover tab's button does. */
  coverOnly?: boolean;
}

/**
 * The book and look with each page Blurb's page size, in inches, so the pages are drawn that shape,
 * with the layouts' print offsets.
 */
function blurbPages(book: PhotoBook, look: PageLook) {
  const { pageWidth, pageHeight } = blurbOf(book);
  return {
    book: { ...book, size: { width: pageWidth, height: pageHeight, unit: "in" as const } },
    look: { ...look, aspect: pageWidth / pageHeight, printWidth: pageWidth, printOffsets: true },
  };
}

/**
 * Draws each PDF's sheets out of sight in turn, through setDrawing, and keeps each as a page for
 * the backend's Chrome, or null when it wasn't drawn.
 */
async function drawEach(pdfs: BlurbPdf[], setDrawing: (drawing: Drawing) => void) {
  const drawn: { pdf: BlurbPdf; html: string | null }[] = [];
  for (const pdf of pdfs) {
    setDrawing(pdf.draw);
    await settle();
    drawn.push({ pdf, html: drawnPages() });
  }
  setDrawing(null);
  return drawn;
}

/**
 * Making the PDFs for Blurb: start draws each out of sight in turn (the pages at Blurb's page size,
 * then the cover at Blurb's cover size), then sends each to the backend and downloads the PDF it
 * makes, in order, stopping at a failure, which shows under the button.
 */
function useBlurbPdf({ book, used, coverOnly = false }: BlurbPdfProps) {
  const [drawing, setDrawing] = useState<Drawing>(null);
  const pdf = useMutation(bookPdfMutation);
  const progress = useQuery({ ...bookPdfProgressQuery(book.id), enabled: pdf.isPending });
  const printed = printedPages(used).length;
  const { pdfs, label, title } = blurbPdfs(book.id, printed, coverOnly, blurbOf(book));
  const start = async () => {
    pdf.reset();
    const drawnPdfs = await drawEach(pdfs, setDrawing);
    for (const { pdf: one, html } of drawnPdfs) {
      const made = html
        ? await pdf
            .mutateAsync({
              id: book.id,
              html,
              pages: one.pages,
              width: one.width,
              height: one.height,
            })
            .catch(() => null)
        : null;
      if (!made) return;
      downloadBlob(one.name, made.blob);
    }
  };
  const busy = drawing !== null || pdf.isPending;
  return {
    start,
    drawing,
    busy,
    disabled: busy || printed === 0,
    text: busy ? pdfProgressText(drawing === "pages", progress.data) : label,
    title,
    error: pdf.error,
  };
}

/**
 * **PDF for Blurb**: makes the two PDFs Blurb takes for a printed book and downloads them, the
 * pages, every page of the book in its order at Blurb's page size, and the cover, back, spine and
 * front on one sheet at Blurb's cover size. The bleed isn't drawn: each page's and the cover's
 * background runs to the PDF's edge. With coverOnly, **Save cover PDF for Blurb** makes only the
 * cover's.
 */
export function BlurbPdfButton(props: BlurbPdfProps) {
  const { start, drawing, ...button } = useBlurbPdf(props);
  const pages = blurbPages(props.book, props.look);
  return (
    <PdfButton {...button} onClick={() => void start()}>
      {drawing === "pages" &&
        createPortal(<PrintBook {...pages} used={props.used} />, document.body)}
      {drawing === "cover" && createPortal(<PrintCover book={props.book} />, document.body)}
    </PdfButton>
  );
}

/** The book's cover as printed, one sheet the size of Blurb's cover PDF, out of sight on the screen. */
function PrintCover({ book }: { book: PhotoBook }) {
  const sizes = blurbOf(book);
  const width = `${sizes.coverWidth}in`;
  const height = `${sizes.coverHeight}in`;
  return (
    <div id={PRINT_ROOT_ID} inert data-print style={{ width }}>
      <style>{sheetCss(width, height)}</style>
      <div style={{ width, height, overflow: "hidden" }}>
        <CoverSheet cover={coverOf(book)} sizes={sizes} />
      </div>
    </div>
  );
}
