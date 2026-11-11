import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { savePhotoBookMutation } from "@/api/photo-books";
import type { PhotoBook } from "@/lib/photo-book";

/** How long after the last change a book waits to be saved, so typing a caption saves once. */
const SAVE_DELAY_MS = 700;

/**
 * A save of book that waits for SAVE_DELAY_MS, replacing one still waiting, and the function that
 * saves the one waiting now. onSaved is called with the book once it's saved.
 */
function useDelayedSave(onSaved: (book: PhotoBook) => void) {
  const save = useMutation(savePhotoBookMutation);
  const waiting = useRef<{ book: PhotoBook; timer: number } | null>(null);
  const { mutate } = save;
  // mutate keeps its identity, so flush does too, and the effect below runs only on leaving.
  const flush = useCallback(() => {
    const pending = waiting.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    waiting.current = null;
    mutate(pending.book, { onSuccess: () => onSaved(pending.book) });
  }, [mutate, onSaved]);
  // Save what's still waiting when the page is left or another book is opened.
  useEffect(() => flush, [flush]);
  const schedule = (book: PhotoBook) => {
    window.clearTimeout(waiting.current?.timer);
    waiting.current = { book, timer: window.setTimeout(flush, SAVE_DELAY_MS) };
  };
  return { schedule, error: save.error, pending: save.isPending };
}

/**
 * The book being edited and a function that changes it. Each change shows at once and is saved as
 * a change waiting for Commit shortly after the last one, so typing doesn't save every letter; a
 * change still waiting is saved when the page is left. saved is the book as the next Commit has it;
 * the page opens each book with its own editor, so it's always the same book.
 */
export function usePhotoBookDraft(saved: PhotoBook) {
  const [draft, setDraft] = useState<PhotoBook | null>(null);
  const onSaved = useCallback(
    (book: PhotoBook) => setDraft((current) => (current === book ? null : current)),
    [],
  );
  const { schedule, error, pending } = useDelayedSave(onSaved);
  const update = (next: PhotoBook) => {
    setDraft(next);
    schedule(next);
  };
  return { book: draft ?? saved, update, error, saving: pending || draft !== null };
}
