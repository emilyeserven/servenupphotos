import { savePhotoBookMutation } from "@/api/photo-books";
import { useDelayedDraft } from "@/hooks/use-delayed-draft";
import type { PhotoBook } from "@/lib/photo-book";

/**
 * The book being edited and a function that changes it, each change saved as a change waiting for
 * Commit shortly after the last one (see useDelayedDraft). saved is the book as the next Commit has
 * it; the page opens each book with its own editor, so it's always the same book.
 */
export function usePhotoBookDraft(saved: PhotoBook) {
  const { value, ...rest } = useDelayedDraft(saved, savePhotoBookMutation);
  return { book: value, ...rest };
}
