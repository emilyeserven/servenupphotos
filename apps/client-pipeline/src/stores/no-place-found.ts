import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface NoPlaceFoundState {
  /** The paths of the photos an LLM's place answer gave no place, in the order they were found. */
  paths: string[];
  /** Remembers that an LLM found no place for these photos. */
  add: (paths: string[]) => void;
  /** Forgets one photo, so Bulk Places picks it again. */
  remove: (path: string) => void;
  /** Forgets every photo, so Bulk Places picks them all again. */
  clear: () => void;
}

/**
 * The photos an LLM found no place for in a Bulk Places answer, kept in this browser's local storage
 * so Bulk Places neither picks nor counts them again, and the Dashboard leaves them out of its count.
 */
export const useNoPlaceFoundStore = create<NoPlaceFoundState>()(
  persist(
    (set) => ({
      paths: [],
      add: (paths) => set((state) => ({ paths: [...new Set([...state.paths, ...paths])] })),
      remove: (path) => set((state) => ({ paths: state.paths.filter((p) => p !== path) })),
      clear: () => set({ paths: [] }),
    }),
    { name: "pipeline-no-place-found", storage: createJSONStorage(() => localStorage) },
  ),
);
