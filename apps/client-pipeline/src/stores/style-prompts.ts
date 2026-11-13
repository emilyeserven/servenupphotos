import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GridFilters } from "@/components/gallery/grid-filters";

/** A Describe my style prompt saved by name: its filters, how many photos, and its question. */
export interface SavedStylePrompt {
  /** The name it was saved as, such as "Japan 2026"; saving under the same name replaces it. */
  name: string;
  /** The portfolio Grid's filters, as the page's URL keeps them. */
  filters: GridFilters;
  /** How many photos to link, as typed. */
  count: string;
  /** The Anything to focus on question; "" for none. */
  focus: string;
  /** When it was saved, as an ISO time. */
  savedAt: string;
}

interface StylePromptsState {
  /** The saved prompts, most recently saved first. */
  prompts: SavedStylePrompt[];
  /** Saves a prompt, replacing one with the same name. */
  save: (prompt: SavedStylePrompt) => void;
  /** Deletes the saved prompt with that name. */
  remove: (name: string) => void;
}

/** The Describe my style page's saved prompts, kept in this browser's local storage. */
export const useStylePromptsStore = create<StylePromptsState>()(
  persist(
    (set) => ({
      prompts: [],
      save: (prompt) =>
        set((state) => ({
          prompts: [prompt, ...state.prompts.filter((p) => p.name !== prompt.name)],
        })),
      remove: (name) => set((state) => ({ prompts: state.prompts.filter((p) => p.name !== name) })),
    }),
    { name: "pipeline-style-prompts", storage: createJSONStorage(() => localStorage) },
  ),
);
