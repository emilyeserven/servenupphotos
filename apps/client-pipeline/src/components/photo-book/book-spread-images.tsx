import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagesIcon } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { bookPdfProgressQuery, spreadImagesMutation } from "@/api/photo-books";
import { ErrorNote } from "@/components/error-note";
import { drawnPages, settle } from "@/components/photo-book/book-pdf";
import { SpreadSheets, drawnSheet } from "@/components/photo-book/book-spread-image";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob } from "@/lib/download-blob";
import type { PhotoBook } from "@/lib/photo-book";
import { type BookUnit, type BookView, bookViews, printedPages } from "@/lib/photo-book-order";
import { pdfProgressText } from "@/lib/photo-book-pdf";
import { SPREAD_ROOT_ID, spreadImageName } from "@/lib/photo-book-spread-image";

interface SpreadImagesProps {
  book: PhotoBook;
  look: PageLook;
  /** The pages and spreads in the book, in its order. */
  used: BookUnit[];
}

/**
 * Saving every spread as an image: start draws them all out of sight, sends them to the backend
 * once drawn and downloads the zip it makes; text is the button's words, how far it has got while
 * busy.
 */
function useSaveSpreadImages({ book, used }: SpreadImagesProps) {
  const [drawing, setDrawing] = useState(false);
  const images = useMutation(spreadImagesMutation);
  const progress = useQuery({
    ...bookPdfProgressQuery(book.id, "spread-images"),
    enabled: images.isPending,
  });
  const views = bookViews(used);
  const start = async () => {
    images.reset();
    setDrawing(true);
    await settle();
    const html = drawnPages(SPREAD_ROOT_ID);
    const sheet = drawnSheet();
    setDrawing(false);
    if (!html || !sheet) return;
    const total = printedPages(used).length;
    const names = views.map((_, at) => spreadImageName(book.id, at, total));
    images.mutate(
      { id: book.id, html, sheet, names },
      { onSuccess: ({ blob }) => downloadBlob(`${book.id}-spreads.zip`, blob) },
    );
  };
  const busy = drawing || images.isPending;
  const text = busy
    ? pdfProgressText(drawing, progress.data, "Making the images…")
    : "Save all as images";
  const disabled = busy || views.length === 0;
  return { start, views, drawing, busy, disabled, text, error: images.error };
}

/**
 * **Save all as images**: draws every spread of the book, as the preview shows them, as one small
 * WEBP image each, as **Save as image** draws one, and downloads them in one zip
 * (`korea-2026-spreads.zip`), saying how far it has got.
 */
export function SaveSpreadImagesButton(props: SpreadImagesProps) {
  const { start, views, drawing, busy, disabled, text, error } = useSaveSpreadImages(props);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        title="Saves every spread of the book as a small WEBP image, all in one zip, to paste into an LLM"
        onClick={() => void start()}
      >
        {busy ? <Spinner /> : <ImagesIcon />}
        {text}
      </Button>
      {error && <ErrorNote error={error} className="max-w-sm text-right" />}
      {drawing && <OutOfSight {...props} views={views} />}
    </div>
  );
}

/** Every spread, drawn out of sight on the page's body for the backend. */
function OutOfSight(props: SpreadImagesProps & { views: BookView[] }) {
  return createPortal(
    <SpreadSheets book={props.book} look={props.look} views={props.views} />,
    document.body,
  );
}
