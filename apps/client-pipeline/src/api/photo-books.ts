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
}

/** Has the backend make a book's PDF with a headless Chrome, and gives the PDF. */
export const bookPdfMutation = mutationOptions({
  mutationKey: ["photobooks", "pdf"],
  mutationFn: ({ id, ...body }: BookPdfRequest) =>
    postForBlob(`/api/photobooks/${encodeURIComponent(id)}/pdf`, body),
});

/** How far the backend has got making a book's PDF: `done` of `total` in `step`. */
export interface BookPdfProgress {
  /** False when no PDF of the book is being made. */
  running: boolean;
  /** Starting Chrome, loading the pages' photos, or printing the pages. */
  step: "" | "starting" | "photos" | "printing";
  /** How many photos have loaded, while loading them. */
  done: number;
  /** How many photos the pages have while loading them; how many pages while printing. */
  total: number;
}

/** How far the book's PDF has got, asked every half second while it's made. */
export const bookPdfProgressQuery = (id: string) =>
  queryOptions({
    queryKey: ["photobooks", "pdf", "progress", id],
    queryFn: () =>
      requestJson<BookPdfProgress>(`/api/photobooks/${encodeURIComponent(id)}/pdf/progress`),
    refetchInterval: 500,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
