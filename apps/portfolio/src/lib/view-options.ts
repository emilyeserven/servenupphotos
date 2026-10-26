import { useEffect } from "react";

/** The views whose own settings, such as the Grid's view or the Tags page's sort, are remembered. */
export type RememberedView = "/grid" | "/color" | "/timeline" | "/tags";

/** A view's own settings as they're kept in its URL, such as `{ view: "table", info: true }`. */
export type ViewOptions = Record<string, unknown>;

const STORAGE_KEY = "servenup-view-options";

/** Each view's settings saved in this browser, read once. */
let remembered: Partial<Record<RememberedView, ViewOptions>> = readStored();

/** The settings saved in this browser, or none when storage is blocked or unreadable. */
function readStored(): Partial<Record<RememberedView, ViewOptions>> {
  try {
    return asObject(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  } catch {
    // Storage can be blocked (private mode, disabled cookies), or hold something unreadable.
    return {};
  }
}

/** The saved value when it's an object, or nothing when it's something else. */
function asObject(stored: unknown): Partial<Record<RememberedView, ViewOptions>> {
  return typeof stored === "object" && stored !== null ? stored : {};
}

/** Saves a view's settings, replacing the ones saved before. */
function remember(view: RememberedView, options: ViewOptions) {
  remembered = { ...remembered, [view]: options };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remembered));
  } catch {
    // Ignore; they're still remembered until the page is reloaded.
  }
}

/**
 * The settings a view was last left with, to add to a link to it so it opens the way it was. The
 * view's `validateSearch` checks them again, so a saved setting it no longer knows is dropped.
 * Nothing for a view that doesn't remember its settings, such as the Map, whose display options
 * are kept on their own (`lib/map-display.ts`).
 */
export function rememberedViewOptions(to: string): ViewOptions {
  return remembered[to as RememberedView] ?? {};
}

/**
 * Remembers a view's own settings whenever they change, so links to it from other pages open it
 * the same way. Only its settings go in, never its filters or open photo.
 */
export function useRememberViewOptions(view: RememberedView, options: object) {
  const saved = JSON.stringify(options);
  useEffect(() => remember(view, JSON.parse(saved) as ViewOptions), [view, saved]);
}
