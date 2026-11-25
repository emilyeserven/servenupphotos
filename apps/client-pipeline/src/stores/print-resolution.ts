import { create } from "zustand";

/** One photo place's measured printed resolution. */
interface PlaceDpi {
  /** The photo file's path that was measured there. */
  photo: string;
  dpi: number;
}

/**
 * The printed resolution of each photo place drawn on a Photo Book page, by `<page ID>:<slot>`,
 * kept after the page is no longer drawn, so the Book tab can list the ones too low to print well.
 * Places measure the same at any size on the screen, so a small preview measures as well as a page.
 */
interface PrintResolutionState {
  places: Map<string, PlaceDpi>;
  setPlace: (key: string, place: PlaceDpi) => void;
}

export const usePrintResolutionStore = create<PrintResolutionState>()((set, get) => ({
  places: new Map(),
  setPlace: (key, place) => {
    const old = get().places.get(key);
    if (old?.photo === place.photo && old.dpi === place.dpi) return;
    set({ places: new Map(get().places).set(key, place) });
  },
}));

/** The store's key for the photo place at slot on the page with ID page, as `lowResolution` reads it. */
export function placeKey(page: string, slot: number): string {
  return `${page}:${slot}`;
}
