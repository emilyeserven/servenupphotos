import { useSyncExternalStore } from "react";

/** A value kept in this browser's local storage, shared by every component that reads it. */
export interface StoredValue<T> {
  /** The value now. */
  get: () => T;
  /** Saves a new value and re-renders every component using it. */
  set: (next: T) => void;
  /** The value, re-rendering on each change, here or in another tab. */
  use: () => T;
}

/**
 * Keeps a value in local storage under key, read once on load and then held in memory. read turns
 * what was saved (parsed JSON, or undefined when nothing was) into the value, so a missing or
 * unreadable entry gives a default rather than an error. A change in another tab, which the
 * browser announces with a `storage` event, is picked up too.
 *
 * > Frontend analogy: a tiny Zustand store whose `persist` middleware writes to localStorage.
 */
export function storedValue<T>(key: string, read: (stored: unknown) => T): StoredValue<T> {
  const load = () => read(parseStored(key));
  let value = load();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    value = load();
    notify();
  };
  const subscribe = (listener: () => void) => {
    if (listeners.size === 0) window.addEventListener("storage", onStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  };
  const get = () => value;
  return {
    get,
    set: (next) => {
      value = next;
      writeStored(key, next);
      notify();
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}

/** What's saved under key as parsed JSON, or undefined when nothing is, storage is blocked or it's unreadable. */
function parseStored(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? undefined : JSON.parse(stored);
  } catch {
    // Storage can be blocked (private mode, disabled cookies), or hold something unreadable.
    return undefined;
  }
}

/** Saves the value under key as JSON. */
function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore; the value still lasts until the page is reloaded.
  }
}
