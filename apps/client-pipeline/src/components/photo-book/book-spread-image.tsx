import { useMutation } from "@tanstack/react-query";
import { ImageDownIcon } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { spreadImageMutation } from "@/api/photo-books";
import { ErrorNote } from "@/components/error-note";
import { PrintPage, drawnPages, settle } from "@/components/photo-book/book-pdf";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob } from "@/lib/download-blob";
import type { PhotoBook } from "@/lib/photo-book";
import type { BookView } from "@/lib/photo-book-order";
import { printSize } from "@/lib/photo-book-pdf";
import {
  SPREAD_IMAGE_LONGEST,
  SPREAD_ROOT_ID,
  spreadImageName,
} from "@/lib/photo-book-spread-image";

interface SpreadImageProps {
  book: PhotoBook;
  look: PageLook;
  /** The two facing pages the preview shows. */
  view: BookView;
  /** Where view is in the book, 0 first. */
  at: number;
  /** How many pages the printed book has, blank placeholders too. */
  total: number;
}

/** The drawn spread's size in CSS pixels, with the image's longer side, or null when it isn't drawn. */
function drawnSheet() {
  const root = document.getElementById(SPREAD_ROOT_ID);
  if (!root) return null;
  const { width, height } = root.getBoundingClientRect();
  return { width, height, longest: SPREAD_IMAGE_LONGEST };
}

/**
 * Saving the spread shown as an image: start draws its two pages out of sight, sends them to the
 * backend once drawn and downloads the WEBP it makes.
 */
function useSaveSpreadImage({ book, at, total }: SpreadImageProps) {
  const [drawing, setDrawing] = useState(false);
  const image = useMutation(spreadImageMutation);
  const start = async () => {
    image.reset();
    setDrawing(true);
    await settle();
    const html = drawnPages(SPREAD_ROOT_ID);
    const sheet = drawnSheet();
    setDrawing(false);
    if (!html || !sheet) return;
    const name = spreadImageName(book.id, at, total);
    image.mutate(
      { id: book.id, html, sheet, name },
      { onSuccess: ({ blob }) => downloadBlob(name, blob) },
    );
  };
  return { start, drawing, busy: drawing || image.isPending, error: image.error };
}

/**
 * **Save as image**: draws the two pages the preview shows as one small WEBP image, about 1568
 * pixels on its longer side, and downloads it, to paste into an LLM for feedback on the spread.
 * Unlike **Save as PDF**, each photo is its resized version, never its original JPEG, so the
 * image stays small; an inside cover is left blank, as it is in **Save spreads as PDF**.
 */
export function SaveSpreadImageButton(props: SpreadImageProps) {
  const { start, drawing, busy, error } = useSaveSpreadImage(props);
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        title="Saves the two pages shown as one small WEBP image, to paste into an LLM"
        onClick={() => void start()}
      >
        {busy ? <Spinner /> : <ImageDownIcon />}
        Save as image
      </Button>
      {error && (
        <ErrorNote
          error={error}
          className="bg-background absolute top-full right-0 z-10 mt-1 w-max max-w-sm text-right"
        />
      )}
      {drawing && createPortal(<SpreadSheet {...props} />, document.body)}
    </div>
  );
}

/** The spread's two pages side by side at the book's page size, out of sight on the screen. */
function SpreadSheet({ book, look, view }: SpreadImageProps) {
  const page = printSize(book);
  const sheet = printSize(book, true);
  return (
    <div inert style={{ position: "fixed", top: 0, left: "-300vw" }}>
      <div id={SPREAD_ROOT_ID} data-preview data-print style={{ ...sheet, display: "flex" }}>
        {view.pages.map((p, i) => (
          <div key={p.id} style={{ ...page, flex: "none", overflow: "hidden" }}>
            <PrintPage page={p} look={look} side={i === 0 ? "left" : "right"} />
          </div>
        ))}
      </div>
    </div>
  );
}
