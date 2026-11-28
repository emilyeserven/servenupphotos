import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { byName, settingEntries, settingMutations, uniqueEntryId } from "@/api/data-files";
import { postForBlob, requestJson } from "@/api/request";
import type { PhotoBook } from "@/lib/photo-book";

function isPhotoBook(value: unknown): value is PhotoBook {
  return Array.isArray((value as Partial<PhotoBook> | null)?.pages);
}

/** The photo books as the next Commit will have them: PHOTOBOOKS.json with the changes since, by name. */
export const photoBooks = settingEntries("photobooks", isPhotoBook, byName);

/** The ID a new book named name gets, such as `korea-2026`, unless one of taken has it already. */
export function photoBookId(name: string, taken: string[]): string {
  return uniqueEntryId(name, taken, "book");
}

const bookMutations = settingMutations<PhotoBook>("photobooks");

/** Saves a photo book, new or changed, as a change waiting for Commit. */
export const savePhotoBookMutation = bookMutations.save;

/** Removes a photo book, as a change waiting for Commit. */
export const deletePhotoBookMutation = bookMutations.remove;

/** What **Save as PDF** sends to have a book's PDF made: its pages as the Book tab drew them. */
interface BookPdfRequest {
  /** The book's ID, which names the PDF, such as `korea-2026.pdf`. */
  id: string;
  /** A whole page holding the book's pages, with their style sheets and the paper size. */
  html: string;
  /** How many pages the PDF has. */
  pages: number;
  /**
   * The exact size each page should measure, in inches, as **PDF for Blurb** asks for: Chrome
   * rounds the paper size a little, and the backend sets it back to this.
   */
  width?: number;
  /** The exact height each page should measure, in inches, with width. */
  height?: number;
}

/** Has the backend make a book's PDF with a headless Chrome, and gives the PDF. */
export const bookPdfMutation = mutationOptions({
  mutationKey: ["photobooks", "pdf"],
  mutationFn: ({ id, ...body }: BookPdfRequest) =>
    postForBlob(`/api/photobooks/${encodeURIComponent(id)}/pdf`, body),
});

/** The size of a spread drawn for **Save as image**, and the size of its image. */
interface SpreadImageSheet {
  /** The spread's width as drawn, in CSS pixels. */
  width: number;
  /** The spread's height as drawn, in CSS pixels. */
  height: number;
  /** How many pixels the image's longer side has. */
  longest: number;
}

/** What **Save as image** sends to have one spread drawn as a small WEBP image. */
interface SpreadImageRequest {
  /** The book's ID. */
  id: string;
  /** A whole page holding the spread at its top left, with its style sheets. */
  html: string;
  /** The spread's size as drawn and the image's longer side. */
  sheet: SpreadImageSheet;
  /** What the image is called, such as `korea-2026-pages-4-5.webp`. */
  name: string;
}

/**
 * Has the backend draw one spread of a book as a small WEBP image with a headless Chrome, each
 * photo its resized version, and gives the image.
 */
export const spreadImageMutation = mutationOptions({
  mutationKey: ["photobooks", "spread-image"],
  mutationFn: ({ id, ...body }: SpreadImageRequest) =>
    postForBlob(`/api/photobooks/${encodeURIComponent(id)}/spread-image`, body),
});

/** What **Save all as images** sends: every spread of the book, one under another. */
interface SpreadImagesRequest {
  /** The book's ID, which names the zip, such as `korea-2026-spreads.zip`. */
  id: string;
  /** A whole page holding the spreads one under another, with their style sheets. */
  html: string;
  /** One spread's size as drawn and each image's longer side. */
  sheet: SpreadImageSheet;
  /** What each spread's image is called in the zip, in the book's order. */
  names: string[];
}

/** Has the backend draw every spread of a book as a small WEBP image, and gives them in one zip. */
export const spreadImagesMutation = mutationOptions({
  mutationKey: ["photobooks", "spread-images"],
  mutationFn: ({ id, ...body }: SpreadImagesRequest) =>
    postForBlob(`/api/photobooks/${encodeURIComponent(id)}/spread-images`, body),
});

/** How far the backend has got making a book's PDF: `done` of `total` in `step`. */
export interface BookPdfProgress {
  /** False when no PDF of the book is being made. */
  running: boolean;
  /** Starting Chrome, loading the pages' photos, printing the pages, or drawing spread images. */
  step: "" | "starting" | "photos" | "printing" | "drawing";
  /** How many photos have loaded, while loading them; how many images are drawn, while drawing. */
  done: number;
  /** How many photos the pages have while loading them; how many pages while printing. */
  total: number;
}

/**
 * How far the book's PDF has got, asked every half second while it's made; with `spread-images`,
 * how far **Save all as images** has got.
 */
export const bookPdfProgressQuery = (id: string, what: "pdf" | "spread-images" = "pdf") =>
  queryOptions({
    queryKey: ["photobooks", what, "progress", id],
    queryFn: () =>
      requestJson<BookPdfProgress>(`/api/photobooks/${encodeURIComponent(id)}/${what}/progress`),
    refetchInterval: 500,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
