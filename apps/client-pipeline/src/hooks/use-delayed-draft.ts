import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long after the last change a draft waits to be saved, so typing saves once. */
const SAVE_DELAY_MS = 700;

/**
 * A save of value that waits for SAVE_DELAY_MS, replacing one still waiting, and the function that
 * saves the one waiting now. onSaved is called with the value once it's saved.
 */
function useDelayedSave<T, R>(
  options: UseMutationOptions<R, Error, T>,
  onSaved: (value: T) => void,
) {
  const save = useMutation(options);
  const waiting = useRef<{ value: T; timer: number } | null>(null);
  const { mutate } = save;
  // mutate keeps its identity, so flush does too, and the effect below runs only on leaving.
  const flush = useCallback(() => {
    const pending = waiting.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    waiting.current = null;
    mutate(pending.value, { onSuccess: () => onSaved(pending.value) });
  }, [mutate, onSaved]);
  // Save what's still waiting when the page is left or another file is opened.
  useEffect(() => flush, [flush]);
  const schedule = (value: T) => {
    window.clearTimeout(waiting.current?.timer);
    waiting.current = { value, timer: window.setTimeout(flush, SAVE_DELAY_MS) };
  };
  return { schedule, error: save.error, pending: save.isPending };
}

/**
 * A file being edited, such as a photo book or the bio, and a function that changes it. Each change
 * shows at once and is saved with options as a change waiting for Commit shortly after the last
 * one, so typing doesn't save every letter; a change still waiting is saved when the page is left.
 * saved is the file as the next Commit has it.
 */
export function useDelayedDraft<T, R>(saved: T, options: UseMutationOptions<R, Error, T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const onSaved = useCallback(
    (value: T) => setDraft((current) => (current === value ? null : current)),
    [],
  );
  const { schedule, error, pending } = useDelayedSave(options, onSaved);
  const value = draft ?? saved;
  // The value as last changed, for a change that finishes after other changes, such as an upload.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  const update = (next: T) => {
    latest.current = next;
    setDraft(next);
    schedule(next);
  };
  /** Changes the value as it is when called, not as it was when the caller rendered. */
  const change = (edit: (current: T) => T) => update(edit(latest.current));
  return { value, update, change, error, saving: pending || draft !== null };
}
